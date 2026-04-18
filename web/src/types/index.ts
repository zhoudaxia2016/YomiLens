export const POS_VALUES = [
  "名詞",
  "動詞",
  "形容詞",
  "形容動詞",
  "助詞",
  "助動詞",
  "副詞",
  "連体詞",
  "接続詞",
  "感動詞",
  "代名詞",
  "接頭辞",
  "接尾辞",
  "記号",
] as const;

export type Pos = (typeof POS_VALUES)[number];

export type ConjugationType = "五段" | "一段" | "カ変" | "サ変" | "形容詞" | "形容動詞";

export type ConjugationForm =
  | "未然形A"
  | "未然形B"
  | "連用形A"
  | "連用形B"
  | "終止形"
  | "連体形"
  | "仮定形"
  | "命令形";

export type Conjugation = {
  type: ConjugationType;
  form: ConjugationForm;
};

export type Token = {
  index: number;
  surface: string;
  lemma: string;
  reading: string;
  furigana: string;
  pos: Pos;
  posDetail: [string, string, string, string];
  byteStart: number;
  byteEnd: number;
  conjugation?: Conjugation;
};

export type ChunkRole = "topic" | "subject" | "object" | "modifier" | "predicate" | "other";

export type Bunsetsu = {
  index: number;
  text: string;
  tokenIndices: number[];
  roleHint: ChunkRole;
};

export type Chunk = {
  index: number;
  text: string;
  tokenIndices: number[];
  bunsetsuIndices: number[];
  roleHint: ChunkRole;
};

export type DependencyEdge = {
  head: number;
  dep: number;
  label: string;
};

export type DependencyAnalysis = {
  level: "chunk";
  root: number;
  edges: DependencyEdge[];
};

export type Sentence = {
  originalText: string;
  tokens: Token[];
  bunsetsu: Bunsetsu[];
  chunks: Chunk[];
  dependencies: DependencyAnalysis | null;
};

export type Paragraph = {
  originalText: string;
  sentences: Sentence[];
};

export type ParsedArticle = {
  title?: string;
  paragraphs: Paragraph[];
};

export type ParseArticleResponse = {
  article: ParsedArticle;
  rawModelOutput: string;
};

export type ParseArticleError = {
  error: string;
  rawModelOutput?: string;
};

export type ArticleStatus = 'draft' | 'parsed'

export type ArticleRecord = {
  id: string
  title: string
  sourceText: string
  tags: string[]
  sourceLocale: 'ja-JP'
  status: ArticleStatus
  latestParseId: string | null
  latestParseVersion: string | null
  paragraphCount: number
  sentenceCount: number
  tokenCount: number
  chunkCount: number
  createdAt: string
  updatedAt: string
  lastParsedAt: string | null
}

export type ArticleParseRecord = {
  id: string
  articleId: string
  parserVersion: string
  sourceTextHash: string
  article: ParsedArticle
  rawModelOutput: string
  paragraphCount: number
  sentenceCount: number
  tokenCount: number
  chunkCount: number
  createdAt: string
}

export type ArticleListItem = {
  id: string
  title: string
}

export type ArticleDetail = {
  article: ArticleRecord
  latestParse: ArticleParseRecord | null
}

export type ListArticlesResponse = {
  articles: ArticleListItem[]
}

export type UpsertArticleInput = {
  title: string
  sourceText: string
  tags: string[]
}

export type TranslationMemory = {
  summary: string;
  characters: Array<{ name: string; description: string }>;
  terms: Array<{ japanese: string; chinese: string }>;
  tone: string;
};

export type TranslationSentence = {
  sentenceIndex: number;
  text: string;
};

export type TranslationModelProvider = 'deepseek' | 'llama'

export type TranslationModelConfig = {
  id: string
  label: string
  provider: TranslationModelProvider
  baseUrl: string
  model: string
  apiKey?: string
}

export type TranslationModelConfigSummary = {
  id: string
  label: string
  provider: TranslationModelProvider
  model: string
}

export type TranslateParagraphInput = {
  currentParagraphIndex: number;
  memory: TranslationMemory | Record<string, never>;
  recentContext: Array<{
    paragraphIndex: number;
    originalText: string;
    translation: string;
  }>;
  currentParagraph: {
    sentences: TranslationSentence[];
  };
  configId?: string;
};

export type TranslateParagraphOutput = {
  paragraphTranslation: string;
  sentences: Array<{
    sentenceIndex: number;
    translation: string;
    tokens: Array<{
      index: number;
      meaning: string;
    }>;
  }>;
  memory: TranslationMemory;
};

export type TranslateParagraphError = {
  error: string;
};

export type TranslateConfigResponse = {
  defaultConfigId: string
  configs: TranslationModelConfigSummary[]
}
