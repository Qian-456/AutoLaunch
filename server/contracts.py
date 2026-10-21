from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, model_validator

ROOT = Path(__file__).resolve().parents[1]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Orbit(StrictModel):
    type: Literal['orbit']
    preset: str


class PartAction(StrictModel):
    type: Literal['window', 'door', 'hatch']
    target: str
    open: StrictBool
    progress: Annotated[StrictInt, Field(ge=0, le=100)]

    @model_validator(mode='after')
    def consistent(self):
        if self.open != (self.progress > 0):
            raise ValueError('inconsistent progress')
        return self


class Trunk(StrictModel):
    type: Literal['trunk']
    open: StrictBool


class Lights(StrictModel):
    type: Literal['lights']
    target: Literal['headlight', 'taillight']
    on: StrictBool


class Cargo(StrictModel):
    type: Literal['cargo']
    operation: Literal['demonstrate']
    combinationId: Literal['two_suitcases']


Action = Annotated[Orbit | PartAction | Trunk | Lights | Cargo, Field(discriminator='type')]


class Scheduled(StrictModel):
    atMs: Annotated[StrictInt, Field(ge=0)]
    action: Action


class Chapter(StrictModel):
    id: str
    title: str
    narration: str
    durationMs: Annotated[StrictInt, Field(ge=1000, le=120_000)]
    camera: str
    actions: list[Scheduled]


class DirectorSelection(StrictModel):
    # This is the entire LLM director output. No arbitrary timeline/tool fields.
    persona: str
    chapterIds: list[str] = Field(min_length=1, max_length=6)


class EvidenceSelection(StrictModel):
    evidenceIds: list[str] = Field(min_length=1, max_length=5)


class DirectorRequest(StrictModel):
    requirement: str = Field(min_length=1, max_length=2000)
    packId: str
    persona: str | None = None


class RagRequest(StrictModel):
    question: str = Field(min_length=1, max_length=2000)
    packId: str


class InstanceCargo(StrictModel):
    type: Literal['cargo']
    operation: Literal['move', 'remove']
    instanceId: str


class TargetedAction(StrictModel):
    packId: str
    entityId: str = 'vehicle'
    targetInstanceId: str | None = None
    actionId: str
    action: Action | InstanceCargo


class Registry:
    def __init__(self, directory: Path = ROOT / 'public/fallbacks'):
        load = lambda n: json.loads((directory / n).read_text(encoding='utf-8'))
        self.data = load('registry-whitelist.json')
        self.personas = load('persona-chapters.json')
        self.intents = load('rag-intent-actions.json')
        self.chapters = {c['id']: Chapter.model_validate(c) for c in load('chapter-pool.json')}
        if list(self.chapters) != self.data['chapterIds']:
            raise ValueError('chapter registry drift')
        if self.personas['personas'] != self.data['personas']:
            raise ValueError('persona registry drift')
        for chapter in self.chapters.values():
            self.validate_chapter(chapter)
        for ids in self.personas['fallbackChapterIdsByPersona'].values():
            self.expand(DirectorSelection(persona=next(iter(self.data['personas'])), chapterIds=ids))
        for intent in self.intents:
            for action in intent['actions']:
                self.action_entry(action)

    def require_pack(self, pack_id: str):
        if pack_id != self.data['packId']:
            raise ValueError('unknown_pack')

    def action_entry(self, action: dict):
        # Exact object equality rejects extra fields, unknown capabilities, coords,
        # fractional/invalid progress and interactive cargo spawn sequences.
        for entry in self.data['actions']:
            if entry['action'] == action:
                return entry
        raise ValueError('unregistered_action')

    def validate_chapter(self, chapter: Chapter):
        if chapter.camera not in self.data['cameras']:
            raise ValueError('unregistered_camera')
        for scheduled in chapter.actions:
            if scheduled.atMs >= chapter.durationMs or scheduled.action.type == 'orbit':
                raise ValueError('invalid_timeline')
            self.action_entry(scheduled.action.model_dump())

    def expand(self, selection: DirectorSelection) -> list[dict]:
        if selection.persona not in self.data['personas']:
            raise ValueError('unknown_persona')
        ids = selection.chapterIds
        if len(ids) != len(set(ids)) or not 1 <= len(ids) <= self.data['limits']['maxChapters']:
            raise ValueError('duplicate_or_empty_chapters')
        if any(c not in self.chapters for c in ids):
            raise ValueError('unknown_chapter')
        chapters = [self.chapters[c] for c in ids]
        for c in chapters:
            self.validate_chapter(c)
        if sum(c.durationMs for c in chapters) > self.data['limits']['maxDurationMs']:
            raise ValueError('timeline_too_long')
        return [c.model_dump() for c in chapters]

    def validate_target(self, command: TargetedAction, instances: dict[str, dict]):
        self.require_pack(command.packId)
        definition = next((e for e in self.data['entities'] if e['entityId'] == command.entityId), None)
        if isinstance(command.action, InstanceCargo):
            if command.actionId != 'cargo:' + command.action.operation or command.action.instanceId != command.targetInstanceId:
                raise ValueError('inconsistent_instance_action')
        elif command.actionId != self.action_entry(command.action.model_dump())['actionId']:
            raise ValueError('invalid_action_id')
        if not definition or command.actionId not in definition['capabilities']:
            raise ValueError('unsupported_entity_capability')
        if command.targetInstanceId is not None:
            instance = instances.get(command.targetInstanceId)
            if not instance or instance['packId'] != command.packId or instance['entityId'] != command.entityId:
                raise ValueError('unknown_or_foreign_instance')
        return command
