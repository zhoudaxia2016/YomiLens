import type { Chunk, Pos, Token } from '@/types'

export type SelectionState = {
  paragraphIndex: number
  sentenceIndex: number
  chunkIndex: number
  activeTokenIndex: number
} | null

const TOKEN_BASE =
  'relative inline-flex min-h-6 items-end justify-center px-[2px] pb-[3px] pt-px text-[18px] font-bold leading-none text-foreground [&_.token-body]:relative [&_.token-body]:after:absolute [&_.token-body]:after:bottom-[-0.08em] [&_.token-body]:after:left-[-1px] [&_.token-body]:after:right-[-1px] [&_.token-body]:after:z-0 [&_.token-body]:after:h-[3px] [&_.token-body]:after:rounded-full [&_.token-body]:after:content-[\"\"]'

export const POS_CLASSNAME: Record<Pos, string> = {
  名詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(var(--main))]`,
  動詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(var(--deep-forest)/0.88)]`,
  形容詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(var(--warm-accent))]`,
  形容動詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(155_26%_46%)]`,
  助詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(var(--main-weak))]`,
  助動詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(36_34%_58%)]`,
  副詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(46_72%_61%)]`,
  連体詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(var(--main-line))]`,
  接続詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(17_64%_66%)]`,
  感動詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(174_27%_54%)]`,
  代名詞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(164_22%_63%)]`,
  接頭辞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(var(--deep-forest)/0.6)]`,
  接尾辞: `${TOKEN_BASE} [&_.token-body]:after:bg-[hsl(var(--main)/0.78)]`,
  記号: 'relative inline-flex min-h-6 items-end justify-center px-[2px] pb-[3px] pt-px text-[18px] font-bold leading-none text-foreground',
}

export const PUNCTUATION_CLASSNAME = '[&_.token-body]:after:hidden'

export function getChunkClassName(chunk: Chunk) {
  switch (chunk.roleHint) {
    case 'subject':
      return 'bg-[hsl(var(--chunk-subject))]'
    case 'topic':
      return 'bg-[hsl(var(--chunk-topic))]'
    case 'object':
      return 'bg-[hsl(var(--chunk-object))]'
    case 'modifier':
      return 'bg-[hsl(var(--chunk-modifier))]'
    case 'predicate':
      return 'bg-[hsl(var(--chunk-predicate))]'
    default:
      return 'bg-[hsl(var(--chunk-other))]'
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
