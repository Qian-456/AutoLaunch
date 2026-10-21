from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass
from typing import Callable, TypeVar

os.environ.setdefault('PYDANTIC_AI_NO_BANNER', '1')

from dotenv import load_dotenv
from openai import APITimeoutError, AsyncOpenAI
from pydantic import BaseModel, ValidationError
from pydantic_ai import Agent, NativeOutput, PromptedOutput
from pydantic_ai.exceptions import ModelHTTPError, UnexpectedModelBehavior
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.profiles.openai import OpenAIModelProfile
from pydantic_ai.providers.openai import OpenAIProvider

from .contracts import ROOT

T = TypeVar('T', bound=BaseModel)


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key: str
    base_url: str
    model: str
    timeout: float
    strategy: str

    def extra_body(self):
        # These parameters are intentionally NOT shared across providers.
        if self.name == 'deepseek': return {'thinking': {'type': 'disabled'}}
        return {'enable_thinking': False}


def settings() -> tuple[list[ProviderConfig], float]:
    load_dotenv(ROOT / '.env', override=False)
    providers = []
    for name, url, model in [
        ('deepseek', 'https://api.deepseek.com', 'deepseek-flash'),
        ('qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen3.8-flash'),
    ]:
        prefix = name.upper()
        key = os.getenv(prefix + '_API_KEY', '').strip()
        if key and not key.lower().startswith(('your-', 'replace-', '<')):
            providers.append(ProviderConfig(name, key, os.getenv(prefix + '_BASE_URL') or url,
                os.getenv(prefix + '_MODEL') or model, min(15, max(.1, float(os.getenv(prefix + '_TIMEOUT', '7')))),
                os.getenv(prefix + '_OUTPUT_STRATEGY', 'json_object')))
    return providers, min(30, max(.1, float(os.getenv('AI_TOTAL_TIMEOUT', '14'))))


async def pydantic_call(config: ProviderConfig, output_type: type[T], instructions: str, data: dict, timeout: float) -> T:
    if config.strategy not in {'json_object', 'json_schema'}:
        raise ValueError('unsupported_output_strategy')
    if config.name == 'deepseek' and config.strategy != 'json_object':
        raise ValueError('deepseek_chat_requires_json_object')
    async with AsyncOpenAI(api_key=config.api_key, base_url=config.base_url, timeout=timeout, max_retries=0) as client:
        profile = OpenAIModelProfile(supports_json_object_output=True, supports_json_schema_output=True,
                                    openai_supports_strict_tool_definition=False,
                                    openai_chat_supports_max_completion_tokens=config.name == 'qwen')
        model = OpenAIChatModel(config.model, provider=OpenAIProvider(openai_client=client), profile=profile)
        body = config.extra_body()
        if config.strategy == 'json_object': body['response_format'] = {'type': 'json_object'}
        output = NativeOutput(output_type) if config.strategy == 'json_schema' else PromptedOutput(output_type)
        agent = Agent(model, output_type=output, instructions=instructions, retries=0,
                      model_settings={'temperature': 0, 'max_tokens': 1000, 'timeout': timeout, 'extra_body': body})
        result = await agent.run(json.dumps(data, ensure_ascii=False), retries=0)
        return output_type.model_validate(result.output)


def failure_kind(exc: Exception) -> str:
    if isinstance(exc, (TimeoutError, asyncio.TimeoutError, APITimeoutError)): return 'timeout'
    code = getattr(exc, 'status_code', None)
    if code in (401, 403): return 'authentication'
    if code == 429: return 'rate_limit'
    if isinstance(exc, (ValidationError, UnexpectedModelBehavior, ValueError)): return 'invalid_output'
    if code and code >= 500: return 'service_error'
    return 'connection_error' if not isinstance(exc, ModelHTTPError) else 'service_error'


@dataclass
class GatewayResult:
    output: BaseModel | None
    mode: str
    provider: str | None = None
    model: str | None = None
    fallbackReason: str | None = None

    def metadata(self):
        return {k: getattr(self, k) for k in ['mode', 'provider', 'model', 'fallbackReason']}


class ModelGateway:
    def __init__(self, providers: list[ProviderConfig] | None = None, total_timeout: float | None = None, call=pydantic_call):
        configured, budget = settings() if providers is None else (providers, 14)
        self.providers = configured
        self.total_timeout = budget if total_timeout is None else total_timeout
        self.call = call

    async def run(self, output_type: type[T], instructions: str, data: dict, validate: Callable[[T], object]) -> GatewayResult:
        deadline = time.monotonic() + self.total_timeout
        failures = []
        for config in self.providers:
            remaining = deadline - time.monotonic()
            if remaining <= 0: failures.append('budget:timeout'); break
            timeout = min(config.timeout, remaining)
            try:
                async with asyncio.timeout(timeout):
                    output = await self.call(config, output_type, instructions, data, timeout)
                    output = output_type.model_validate(output)
                    validate(output)
                return GatewayResult(output, 'live', config.name, config.model, ';'.join(failures) or None)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                # Never log exception text, request bodies, credentials or private URLs.
                failures.append(config.name + ':' + failure_kind(exc))
        return GatewayResult(None, 'fallback', fallbackReason=';'.join(failures) or 'no_provider_configured')
