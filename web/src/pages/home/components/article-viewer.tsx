import { useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import type { ArticleRecord, ParsedArticle, TranslateParagraphOutput } from '@/types'
import { ChunkPopover } from './chunk-popover'
import { TokenSurface } from './token-surface'
import {
  buildTokenKey,
  getChunkClassName,
  isPunctuationToken,
  POS_CLASSNAME,
  type SelectionState,
} from '../utils'

type ArticleViewerProps = {
  currentArticle: ArticleRecord | null
  article: ParsedArticle | null
  selection: SelectionState
  translations: Map<number, TranslateParagraphOutput>
  translating: boolean
  onSelectChunk: (payload: SelectionState) => void
  onTranslate: () => void
}

export function ArticleViewer({ 
  currentArticle,
  article, 
  selection, 
  translations, 
  translating,
  onSelectChunk,
  onTranslate 
}: ArticleViewerProps) {
  const isInternalUpdate = useRef(false)
  const statusLabel = currentArticle
    ? currentArticle.status === 'parsed'
      ? '已解析'
      : '待解析'
    : null

  const selectedContext =
    article && selection
      ? (() => {
          const paragraph = article.paragraphs[selection.paragraphIndex]
          const sentence = paragraph?.sentences[selection.sentenceIndex]
          const chunk = sentence?.chunks[selection.chunkIndex]
          const token =
            sentence?.tokens.find((item) => item.index === selection.activeTokenIndex) ??
            (chunk ? sentence.tokens[chunk.tokenIndices[0]] : null)

          if (!sentence || !chunk || !token) {
            return null
          }

          return { sentence, chunk, token }
        })()
      : null

  return (
    <Card className="article-card">
      <CardHeader className="article-card-head">
        <div>
          <CardTitle>解析结果</CardTitle>
          <p className="muted">
            {currentArticle
              ? `${statusLabel} · ${currentArticle.paragraphCount} 段 / ${currentArticle.sentenceCount} 句`
              : ''}
          </p>
        </div>
        <Button onClick={onTranslate} disabled={translating || !article}>
          {translating ? '翻译中…' : '翻译'}
        </Button>
      </CardHeader>
      <CardContent>
        {!article ? <div className="empty-state">还没有解析结果。先保存文章，再执行解析。</div> : null}
        <div className="article-flow">
          {article?.paragraphs.map((paragraph, paragraphIndex) => {
            const translation = translations.get(paragraphIndex)
            
            return (
              <article className="paragraph-card" key={`${paragraph.originalText}-${paragraphIndex}`}>
                {paragraph.sentences.map((sentence, sentenceIndex) => {
                  const sentenceTranslation = translation?.sentences.find(
                    (s) => s.sentenceIndex === sentenceIndex
                  )
                  
                  return (
                    <section className="sentence-card" key={`${sentence.originalText}-${sentenceIndex}`}>
                      <div className="chunk-row">
                        {sentence.chunks.map((chunk, chunkIndex) => {
                          const isSelected =
                            selection?.paragraphIndex === paragraphIndex &&
                            selection?.sentenceIndex === sentenceIndex &&
                            selection?.chunkIndex === chunkIndex

                          return (
                            <Popover
                              key={`${sentence.originalText}-${chunkIndex}`}
                              open={isSelected}
                              onOpenChange={(open) => {
                                if (isInternalUpdate.current) {
                                  return
                                }

                                if (open) {
                                  isInternalUpdate.current = true
                                  onSelectChunk({
                                    paragraphIndex,
                                    sentenceIndex,
                                    chunkIndex,
                                    activeTokenIndex: chunk.tokenIndices[0],
                                  })
                                  requestAnimationFrame(() => {
                                    isInternalUpdate.current = false
                                  })
                                } else if (isSelected) {
                                  onSelectChunk(null)
                                }
                              }}
                            >
                              <div className="chunk-anchor">
                                <PopoverTrigger asChild>
                                  <button
                                    className={[
                                      'chunk-chip',
                                      getChunkClassName(chunk),
                                      isSelected ? 'chunk-chip-selected' : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                    type="button"
                                  >
                                    {chunk.tokenIndices.map((tokenIndex) => {
                                      const token = sentence.tokens[tokenIndex]
                                      const isActive = isSelected && selection?.activeTokenIndex === tokenIndex

                                      return (
                                        <span
                                          className={[
                                            POS_CLASSNAME[token.pos],
                                            isPunctuationToken(token.surface) ? 'token-punctuation' : '',
                                            isActive ? 'token-highlighted' : '',
                                          ]
                                            .filter(Boolean)
                                            .join(' ')}
                                          key={buildTokenKey(token)}
                                        >
                                          <TokenSurface token={token} />
                                        </span>
                                      )
                                    })}
                                  </button>
                                </PopoverTrigger>

                                {isSelected && selectedContext ? (
                                  <PopoverContent className="chunk-popover" align="start" side="bottom" sideOffset={10}>
                                    <ChunkPopover
                                      chunk={chunk}
                                      sentence={sentence}
                                      token={selectedContext.token}
                                      activeTokenIndex={selection.activeTokenIndex}
                                      tokenMeanings={sentenceTranslation?.tokens}
                                      onSelectToken={(tokenIndex) =>
                                        onSelectChunk({
                                          paragraphIndex,
                                          sentenceIndex,
                                          chunkIndex,
                                          activeTokenIndex: tokenIndex,
                                        })
                                      }
                                    />
                                  </PopoverContent>
                                ) : null}
                              </div>
                            </Popover>
                          )
                        })}
                      </div>
                      {sentenceTranslation?.translation ? (
                        <p className="sentence-translation">{sentenceTranslation.translation}</p>
                      ) : null}
                    </section>
                  )
                })}
              </article>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
