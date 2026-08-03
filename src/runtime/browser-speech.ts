export type SpeechRecognitionErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'

type SpeechAlternativeLike = { transcript: string }
type SpeechResultLike = { readonly isFinal: boolean; readonly length: number; [index: number]: SpeechAlternativeLike }
type SpeechResultListLike = { readonly length: number; [index: number]: SpeechResultLike }

export type SpeechRecognitionResultEventLike = {
  readonly resultIndex: number
  readonly results: SpeechResultListLike
}

export type SpeechRecognitionErrorEventLike = {
  readonly error: SpeechRecognitionErrorCode
  readonly message?: string
}

export type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
}

export function createBrowserSpeechRecognition(windowRef: Window = window) {
  const speechWindow = windowRef as SpeechWindow
  const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  return Constructor ? new Constructor() : null
}
