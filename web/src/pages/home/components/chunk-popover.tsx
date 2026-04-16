import { Badge } from '@/components/ui/badge'
import type { Chunk, Sentence, Token } from '@/types'
import { buildTokenKey } from '../utils'

type ChunkPopoverProps = {
  chunk: Chunk
  sentence: Sentence
  token: Token
  activeTokenIndex: number
  onSelectToken: (tokenIndex: number) => void
}

export function ChunkPopover({
  chunk,
  sentence,
  token,
  activeTokenIndex,
  onSelectToken,
}: ChunkPopoverProps) {
  return (
    <div className="chunk-popover">
      <p className="section-kicker">Chunk</p>
      <div className="chunk-tabs">
        {chunk.tokenIndices.map((tokenIndex) => {
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

      <div className="chunk-detail">
        <div className="chunk-detail-head">
          <h3>{token.surface}</h3>
          <Badge variant="secondary" className="detail-badge">
            {token.pos}
          </Badge>
        </div>
        <p className="detail-reading">
          {token.reading}
          {token.furigana ? ` / ${token.furigana}` : ''}
        </p>
        <dl className="detail-grid detail-grid-compact">
          <div>
            <dt>原形</dt>
            <dd>{token.lemma}</dd>
          </div>
          <div>
            <dt>词性</dt>
            <dd>{token.pos}</dd>
          </div>
          <div>
            <dt>语块</dt>
            <dd>{chunk.text}</dd>
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
