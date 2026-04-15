export const POS_VALUES = [
  '名詞',
  '動詞',
  '形容詞',
  '形容動詞',
  '助詞',
  '助動詞',
  '副詞',
  '連体詞',
  '接続詞',
  '感動詞',
  '代名詞',
  '接頭辞',
  '接尾辞',
] as const

export type Pos = (typeof POS_VALUES)[number]

export const RELATION_VALUES = [
  'root',
  'nsubj',
  'dobj',
  'iobj',
  'advmod',
  'aux',
  'auxpass',
  'mark',
  'case',
  'nmod',
  'amod',
  'det',
  'neg',
  'cc',
  'conj',
  'punct',
  'compound',
  'nummod',
] as const

export type Relation = (typeof RELATION_VALUES)[number]

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type ConjugationType = '五段' | '一段' | 'カ変' | 'サ変' | '形容詞' | '形容動詞'
export type ConjugationForm =
  | '未然形A'
  | '未然形B'
  | '連用形A'
  | '連用形B'
  | '終止形'
  | '連体形'
  | '仮定形'
  | '命令形'
export type AuxiliaryKind = '助動詞' | '助詞'

export type Conjugation = {
  type: ConjugationType
  form: ConjugationForm
  auxiliary?: {
    kind: AuxiliaryKind
    text: string
  }
}

export type Token = {
  surface: string
  lemma: string
  reading: string
  furigana: string
  pos: Pos
  meaning: string
  conjugation?: Conjugation
}

export type DependencyNode = {
  text: string
  tokenIndices: number[]
  relation: Relation
  children: DependencyNode[]
}

export type GrammarTip = {
  point: string
  description: string
  difficulty: Difficulty
  tokenIndices: number[]
}

export type Sentence = {
  originalText: string
  tokens: Token[]
  translation?: string
  dependencyTree: DependencyNode
  grammarTips?: GrammarTip[]
}

export type Paragraph = {
  originalText: string
  sentences: Sentence[]
}

export type ParsedArticle = {
  title?: string
  paragraphs: Paragraph[]
}

export type ParseArticleResponse = {
  article: ParsedArticle
  rawModelOutput: string
}

export type ParseArticleError = {
  error: string
  rawModelOutput?: string
}
