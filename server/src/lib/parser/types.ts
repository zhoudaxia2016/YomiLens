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

export type Pos = typeof POS_VALUES[number];

export type ConjugationType =
  | "五段"
  | "一段"
  | "カ変"
  | "サ変"
  | "形容詞"
  | "形容動詞";

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

export type LinderaToken = {
  surface: string;
  baseForm: string;
  reading: string;
  partOfSpeech: string;
  partOfSpeechSubcategory1: string;
  partOfSpeechSubcategory2: string;
  partOfSpeechSubcategory3: string;
  conjugationType: string;
  conjugationForm: string;
  byteStart: number;
  byteEnd: number;
};

export type NodeLabel = "token" | "noun_phrase" | "modifier" | "predicate" | "other";

export type Node = {
  label: NodeLabel;
  tokens: Token[];
};

type MatchValue<T extends string> = T | T[];

export type PatternPart = {
  label?: MatchValue<NodeLabel>;
  pos?: MatchValue<Pos>;
  pos1?: MatchValue<string>;
  pos2?: MatchValue<string>;
  surface?: MatchValue<string>;
  lemma?: MatchValue<string>;
  category?: "nominal" | "predicate" | "modifier" | "particleLike" | "punctuation";
  singleTokenOnly?: boolean;
  custom?: (node: Node) => boolean;
};

export type SequenceRule = {
  name: string;
  priority: number;
  pattern: PatternPart[];
  resultLabel: NodeLabel;
  resultLabelResolver?: (nodes: Node[], index: number, length: number) => NodeLabel;
};
