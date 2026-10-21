"""Explicit paid provider check: python -m server.smoke --live --provider qwen."""
import argparse
import asyncio
import json

from .contracts import DirectorSelection, Registry, DirectorRequest, RagRequest
from .gateway import ModelGateway, settings
from .service import LaunchService


async def main():
    parser = argparse.ArgumentParser(description='Opt-in live connectivity + structured-output smoke test')
    parser.add_argument('--live', action='store_true', help='Explicitly enable a paid API request')
    parser.add_argument('--provider', choices=['deepseek', 'qwen'], required=True)
    parser.add_argument('--workflow', action='store_true', help='Also test real requirement understanding and grounded RAG (two requests)')
    args = parser.parse_args()
    if not args.live: parser.error('--live is required; default tests never call paid APIs')
    providers, budget = settings()
    providers = [p for p in providers if p.name == args.provider]
    if not providers:
        print(json.dumps({'provider': args.provider, 'result': 'not_configured'})); return 2
    registry = Registry()
    gateway = ModelGateway(providers, max(budget, 14))
    if args.workflow:
        service = LaunchService(registry, gateway)
        director = await service.director(DirectorRequest(requirement='一家三口周末出游，重点看看装东西方便不方便。', packId=registry.data['packId']))
        rag = await service.rag(RagRequest(question='后备箱多大？', packId=registry.data['packId']))
        result = {'director': {k: director[k] for k in ['mode', 'provider', 'model', 'fallbackReason', 'selection']},
                  'rag': {k: rag[k] for k in ['mode', 'provider', 'model', 'fallbackReason']},
                  'citationCount': len(rag['citations']), 'linkedActionCount': len(rag['linkedActions'])}
        print(json.dumps(result, ensure_ascii=True))
        return 0 if director['mode'] == rag['mode'] == 'live' else 1
    result = await gateway.run(DirectorSelection,
        '仅输出 JSON {"persona":"family","chapterIds":["rear-hatch"]}，不要输出其他字段。', {}, registry.expand)
    print(json.dumps({**result.metadata(), 'selection': result.output.model_dump() if result.output else None}, ensure_ascii=True))
    return 0 if result.mode == 'live' else 1


if __name__ == '__main__': raise SystemExit(asyncio.run(main()))
