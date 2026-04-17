import { Badge } from '@/components/ui/badge'
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
        <div className="chunk-tabs">
          {nonPunctuationTokens.map((tokenIndex) => {
            const candidate = sentence.tokens[tokenIndex]
            const active = activeTokenIndex === tokenIndex

            return (
              <button
                className={active ? 'chunk-tab chunk-tab-active' : 'chunk-tab'}
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

      <div className="chunk-detail">
        <div className="chunk-detail-head">
          <h3>{token.surface}</h3>
          <Badge variant="secondary" className="detail-badge">
            {token.pos}
          </Badge>
        </div>
        <p className="detail-reading">
          {token.furigana || token.reading}
        </p>
        {currentTokenMeaning ? (
          <p className="detail-meaning">{currentTokenMeaning}</p>
        ) : null}
        <dl className="detail-grid detail-grid-compact">
          <div>
            <dt>原形</dt>
            <dd>{token.lemma}</dd>
          </div>
          <div>
            <dt>语块角色</dt>
            <dd>{chunk.roleHint}</dd>
          </div>
        </dl>
        {token.conjugation ? (
          <div className="conjugation-card">
            <p className="detail-subtitle">活用信息</p>
            <p>{token.conjugation.type}</p>
            <p>{token.conjugation.form}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
