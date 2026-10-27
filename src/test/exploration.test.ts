import { beforeEach, expect, it } from 'vitest'
import { routeAssistantInput } from '../runtime/input-router'
import { dispatchVehicleActions } from '../runtime/action-dispatcher'
import { explorationTopics } from '../pack/exploration-topics'
import { registeredAction } from '../runtime/ai-contract'
import { useExperienceStore } from '../store/experience-store'

beforeEach(() => useExperienceStore.setState({ playback: 'idle', controlEpoch: 0, manualOrbit: true, activeActions: new Map() }))

it('sends questions to RAG and explicit demonstrations to Director without rewriting text', () => {
  for (const text of ['后备箱多大', '车窗怎么操作', '打开车窗能改善隔音吗？', '我想了解后排舒适度']) {
    expect(routeAssistantInput(text)).toEqual({ kind: 'question', text })
  }
  for (const text of ['带我看看家庭出游', '先看灯光，再看车身', '一家三口周末出游，请演示装载']) {
    expect(routeAssistantInput(text)).toEqual({ kind: 'director', text })
  }
  expect(routeAssistantInput('打开主驾车窗').kind).toBe('command')
  expect(routeAssistantInput('主驾车窗50%', 'director').kind).toBe('command')
  expect(routeAssistantInput('后排空间', 'director')).toEqual({ kind: 'director', text: '后排空间' })
  expect(routeAssistantInput('带我看看灯光', 'question').kind).toBe('question')
  expect(routeAssistantInput('别打开车窗').kind).toBe('question')
})

it('a validated RAG batch keeps its registered camera after a part action', () => {
  const result = dispatchVehicleActions([{ type: 'orbit', preset: 'rear_three_quarter' }, { type: 'trunk', open: true }], 'rag')
  expect(result.every((entry) => entry.ok)).toBe(true)
  expect(useExperienceStore.getState().activeOrbitPreset).toBe('rear_three_quarter')
  expect(useExperienceStore.getState().manualOrbit).toBe(false)
  expect(useExperienceStore.getState().controlEpoch).toBe(1)
  expect([...useExperienceStore.getState().activeActions.values()].every((action) => action.source === 'rag')).toBe(true)
})

it('empty answer actions do not take control of the camera', () => {
  expect(dispatchVehicleActions([], 'rag')).toEqual([])
  expect(useExperienceStore.getState().controlEpoch).toBe(0)
  expect(useExperienceStore.getState().manualOrbit).toBe(true)
})

it('business themes reuse registered actions without inventing comfort capabilities', () => {
  for (const topic of explorationTopics) {
    expect(topic.actions.every(registeredAction)).toBe(true)
    if (topic.requirement) expect(routeAssistantInput(topic.requirement).kind).toBe('director')
  }
  expect(explorationTopics.find((topic) => topic.id === 'comfort')?.requirement).toBeNull()
})
