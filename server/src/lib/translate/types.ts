import type { ParsedArticle } from "../parser/types.ts";

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

export type TranslationModelProvider = "deepseek" | "llama";

export type TranslationModelConfig = {
  label: string;
  provider: TranslationModelProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type TranslationModelConfigSummary = {
  label: string;
  provider: TranslationModelProvider;
  model: string;
};

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
  model?: string
}

export type TranslateArticleInput = {
  provider: TranslationModelProvider
  model?: string
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
  metrics?: {
    promptMs?: number
    predictedMs?: number
  }
}

export type StoredTranslatedParagraph = {
  sentences: string[]
}

export type StoredArticleTranslation = {
  paragraphs: StoredTranslatedParagraph[]
  memory: TranslationMemory | Record<string, never>
}

export type TranslateConfigResponse = {
  providers: TranslationModelConfigSummary[]
}

export type TranslateStreamEvent =
  | {
    type: "start"
    totalParagraphs: number
    parse: ParsedArticle
  }
  | {
    type: "paragraph"
    sentences: string[]
  }
  | {
    type: "complete"
  }
  | {
    type: "error"
    error: string
  };
