import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Chunk, Sentence, Token } from '@/types'
import { buildTokenKey, isPunctuationToken } from '../utils'

type ChunkPopoverProps = {
  chunk: Chunk
  sentence: Sentence
  token: Token
  activeTokenIndex: number
  tokenMeanings?: Array<{ index: number; meaning: string }>
  onSelectToken: (tokenIndex: number) => void
}

export function ChunkPopover({
  chunk,
  sentence,
  token,
  activeTokenIndex,
  tokenMeanings,
  onSelectToken,
}: ChunkPopoverProps) {
  const nonPunctuationTokens = chunk.tokenIndices.filter(
    (tokenIndex) => !isPunctuationToken(sentence.tokens[tokenIndex].surface)
  )

  const currentTokenMeaning = tokenMeanings?.find((m) => m.index === token.index)?.meaning

  return (
    <div>
      {nonPunctuationTokens.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {nonPunctuationTokens.map((tokenIndex) => {
            const candidate = sentence.tokens[tokenIndex]
            const active = activeTokenIndex === tokenIndex

            return (
              <button
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  active
                    ? 'border-primary/20 bg-brand-soft text-foreground'
                    : 'border-panel-border bg-background text-muted-foreground hover:bg-accent',
                )}
                key={`${buildTokenKey(candidate)}-tab`}
                type="button"
                onClick={() => onSelectToken(tokenIndex)}
              >
                {candidate.surface}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="m-0 text-2xl font-semibold text-foreground">{token.surface}</h3>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
            {token.pos}
          </Badge>
        </div>
        <p className="m-0 text-lg text-muted-foreground">{token.furigana || token.reading}</p>
        {currentTokenMeaning ? (
          <p className="m-0 rounded-2xl bg-panel-muted px-4 py-3 text-sm leading-6 text-foreground">
            {currentTokenMeaning}
          </p>
        ) : null}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-panel-border bg-background/75 px-4 py-3">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80">原形</dt>
            <dd className="mt-1 text-sm leading-6 text-foreground">{token.lemma}</dd>
          </div>
          <div className="rounded-2xl border border-panel-border bg-background/75 px-4 py-3">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80">语块角色</dt>
            <dd className="mt-1 text-sm leading-6 text-foreground">{chunk.roleHint}</dd>
          </div>
        </dl>
        {token.conjugation ? (
          <div className="rounded-2xl bg-brand-soft px-4 py-3">
            <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-primary/80">活用信息</p>
            <p className="mt-2 text-sm leading-6 text-foreground">{token.conjugation.type}</p>
            <p className="m-0 text-sm leading-6 text-foreground">{token.conjugation.form}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
