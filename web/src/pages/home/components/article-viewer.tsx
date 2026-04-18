import { useEffect, useRef } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ArticleRecord, ParsedArticle, TranslateParagraphOutput } from '@/types'
import { ChunkPopover } from './chunk-popover'
import { TokenSurface } from './token-surface'
import {
  buildTokenKey,
  getChunkClassName,
  isPunctuationToken,
  PUNCTUATION_CLASSNAME,
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

  useEffect(() => {
    if (!selection) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof HTMLElement)) {
        return
      }

      if (target.closest('[data-chunk-overlay-root="true"]')) {
        return
      }

      onSelectChunk(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [selection, onSelectChunk])

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
    <Card className="overflow-visible">
      <CardHeader className="mb-4 flex flex-col items-start justify-between gap-4 pb-0 sm:flex-row">
        <div>
          <CardTitle className="text-2xl text-foreground">解析结果</CardTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {currentArticle
              ? `${statusLabel} · ${currentArticle.paragraphCount} 段 / ${currentArticle.sentenceCount} 句`
              : ''}
          </p>
        </div>
        <Button className="py-1.5" onClick={onTranslate} disabled={translating || !article}>
          {translating ? '翻译中…' : '翻译'}
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {!article ? (
          <Alert className="mb-4" variant="default">
            <AlertTitle>暂无解析结果</AlertTitle>
            <AlertDescription>先保存文章，再执行解析。</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-[18px]">
          {article?.paragraphs.map((paragraph, paragraphIndex) => {
            const translation = translations.get(paragraphIndex)
            
            return (
              <article
                className="mb-6 border-b border-panel-border/70 pb-6 last:mb-0 last:border-b-0 last:pb-0"
                key={`${paragraph.originalText}-${paragraphIndex}`}
              >
                {paragraph.sentences.map((sentence, sentenceIndex) => {
                  const sentenceTranslation = translation?.sentences.find(
                    (s) => s.sentenceIndex === sentenceIndex
                  )
                  
                  return (
                    <section className="mt-5 first:mt-0" key={`${sentence.originalText}-${sentenceIndex}`}>
                      <div className="flex flex-wrap items-end gap-x-1.5 gap-y-2 leading-8">
                        {sentence.chunks.map((chunk, chunkIndex) => {
                          const isSelected =
                            selection?.paragraphIndex === paragraphIndex &&
                            selection?.sentenceIndex === sentenceIndex &&
                            selection?.chunkIndex === chunkIndex

                          return (
                            <div
                              className="relative"
                              data-chunk-overlay-root="true"
                              key={`${sentence.originalText}-${chunkIndex}`}
                            >
                              <button
                                className={cn(
                                  'inline-flex min-h-10 flex-wrap items-end justify-center gap-0.5 rounded-xl border border-transparent px-[7px] pb-[5px] pt-1 transition-[box-shadow,border-color,transform] duration-150 hover:border-[hsl(var(--main-line)/0.9)]',
                                  getChunkClassName(chunk),
                                  isSelected &&
                                    'border-primary/40 shadow-[0_10px_24px_hsl(var(--panel-shadow)/0.14)]',
                                )}
                                type="button"
                                onClick={() => {
                                  if (isInternalUpdate.current) {
                                    return
                                  }

                                  isInternalUpdate.current = true
                                  onSelectChunk(
                                    isSelected
                                      ? null
                                      : {
                                          paragraphIndex,
                                          sentenceIndex,
                                          chunkIndex,
                                          activeTokenIndex: chunk.tokenIndices[0],
                                        },
                                  )
                                  requestAnimationFrame(() => {
                                    isInternalUpdate.current = false
                                  })
                                }}
                              >
                                {chunk.tokenIndices.map((tokenIndex) => {
                                  const token = sentence.tokens[tokenIndex]
                                  const isActive = isSelected && selection?.activeTokenIndex === tokenIndex

                                  return (
                                    <span
                                      className={cn(
                                        POS_CLASSNAME[token.pos],
                                        isPunctuationToken(token.surface) && PUNCTUATION_CLASSNAME,
                                        isActive && 'rounded-[0.45rem] shadow-[inset_0_-0.7rem_0_hsl(var(--soft-mint)/0.95)]',
                                      )}
                                      key={buildTokenKey(token)}
                                    >
                                      <TokenSurface token={token} />
                                    </span>
                                  )
                                })}
                              </button>

                              {isSelected && selectedContext ? (
                                <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-[min(92vw,28rem)] rounded-[24px] border border-panel-border bg-popover/95 p-4 text-popover-foreground shadow-[0_24px_60px_hsl(var(--panel-shadow)/0.2)] backdrop-blur">
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
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                      {sentenceTranslation?.translation ? (
                        <p className="mt-3 pl-1 text-base leading-7 text-muted-foreground">
                          {sentenceTranslation.translation}
                        </p>
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
