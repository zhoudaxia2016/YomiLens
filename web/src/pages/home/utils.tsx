import type { Chunk, ParsedArticle, Pos, Token } from '@/types'

export type SelectionState = {
  paragraphIndex: number
  sentenceIndex: number
  chunkIndex: number
  activeTokenIndex: number
} | null

export const POS_CLASSNAME: Record<Pos, string> = {
  名詞: 'token token-noun',
  動詞: 'token token-verb',
  形容詞: 'token token-adjective',
  形容動詞: 'token token-adjectival-noun',
  助詞: 'token token-particle',
  助動詞: 'token token-auxiliary',
  副詞: 'token token-adverb',
  連体詞: 'token token-attributive',
  接続詞: 'token token-conjunction',
  感動詞: 'token token-interjection',
  代名詞: 'token token-pronoun',
  接頭辞: 'token token-prefix',
  接尾辞: 'token token-suffix',
  記号: 'token token-punctuation',
}

export function findInitialSelection(article: ParsedArticle): SelectionState {
  for (const [paragraphIndex, paragraph] of article.paragraphs.entries()) {
    for (const [sentenceIndex, sentence] of paragraph.sentences.entries()) {
      const firstChunk = sentence.chunks[0]
      if (firstChunk) {
        return {
          paragraphIndex,
          sentenceIndex,
          chunkIndex: firstChunk.index,
          activeTokenIndex: firstChunk.tokenIndices[0],
        }
      }
    }
  }

  return null
}

export function getChunkClassName(chunk: Chunk) {
  switch (chunk.roleHint) {
    case 'subject':
      return 'chunk-subject'
    case 'topic':
      return 'chunk-conj'
    case 'object':
      return 'chunk-object'
    case 'modifier':
      return 'chunk-adverbial'
    case 'predicate':
      return 'chunk-aux'
    default:
      return 'chunk-neutral'
  }
}

export function needsRuby(surface: string) {
  return /[\u4e00-\u9fff々ヶ]/.test(surface)
}

export function isPunctuationToken(surface: string) {
  return /^[、。！？「」『』（）()［］【】・,.;:]+$/.test(surface)
}

export function buildTokenKey(token: Token) {
  return `${token.surface}-${token.index}`
}
