import { describe, expect, it } from 'vitest'
import { createBrowserSpeechRecognition } from '../runtime/browser-speech'

describe('browser speech recognition adapter', () => {
  it('returns null when neither browser constructor is available', () => {
    expect(createBrowserSpeechRecognition({} as Window)).toBeNull()
  })

  it('supports the prefixed constructor used by Chromium implementations', () => {
    class FakeRecognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onstart = null
      onend = null
      onresult = null
      onerror = null
      start() {}
      stop() {}
      abort() {}
    }

    const recognition = createBrowserSpeechRecognition({ webkitSpeechRecognition: FakeRecognition } as unknown as Window)
    expect(recognition).toBeInstanceOf(FakeRecognition)
  })
})
