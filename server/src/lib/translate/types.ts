export type TranslationMemory = {
  summary: string
  characters: Array<{ name: string; description: string }>
  terms: Array<{ japanese: string; chinese: string }>
  tone: string
}

export type TranslationSentence = {
  sentenceIndex: number
  text: string
}

export type TranslateParagraphInput = {
  currentParagraphIndex: number
  memory: TranslationMemory | Record<string, never>
  recentContext: Array<{
    paragraphIndex: number
    originalText: string
    translation: string
  }>
  currentParagraph: {
    sentences: TranslationSentence[]
  }
}

export type TranslateParagraphOutput = {
  paragraphTranslation: string
  sentences: Array<{
    sentenceIndex: number
    translation: string
    tokens: Array<{
      index: number
      meaning: string
    }>
  }>
  memory: TranslationMemory
}
