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
  parse: ParsedArticle;
};

export type ParseArticleError = {
  error: string;
};

export type ArticleRecord = {
  id: string
  title: string
  text: string
  tags: string[]
  latestProcessId: string | null
  createdAt: string
  updatedAt: string
}

export type StoredTranslatedParagraph = {
  sentences: string[]
}

export type StoredArticleTranslation = {
  paragraphs: StoredTranslatedParagraph[]
  memory: TranslationMemory | Record<string, never>
}

export type ArticleProcessRecord = {
  id: string
  articleId: string
  text: string
  parse: ParsedArticle | null
  translation: StoredArticleTranslation | null
  provider: TranslationModelProvider | null
  model: string | null
  createdAt: string
  updatedAt: string
}

export type ArticleListItem = {
  id: string
  title: string
}

export type ArticleDetail = {
  article: ArticleRecord
  latestProcess: ArticleProcessRecord | null
}

export type ListArticlesResponse = {
  articles: ArticleListItem[]
}

export type UpsertArticleInput = {
  title: string
  text: string
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
  label: string
  provider: TranslationModelProvider
  baseUrl: string
  model: string
  apiKey?: string
}

export type TranslationModelConfigSummary = {
  label: string
  provider: TranslationModelProvider
  model: string
}

export type TranslateArticleInput = {
  provider: TranslationModelProvider
  model?: string
}

export type TranslateParagraphError = {
  error: string;
};

export type TranslateConfigResponse = {
  providers: TranslationModelConfigSummary[]
}

export type TranslateStreamEvent =
  | {
    type: 'start'
    totalParagraphs: number
    parse: ParsedArticle
  }
  | {
    type: 'paragraph'
    sentences: string[]
  }
  | {
    type: 'complete'
  }
  | {
    type: 'error'
    error: string
  }
