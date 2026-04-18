import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type {
  ArticleDetail,
  ArticleListItem,
  ParsedArticle,
  TranslateConfigResponse,
  TranslationMemory,
  TranslationModelProvider,
  TranslateParagraphOutput,
  UpsertArticleInput,
} from '@/types'
import { ArticleComposer } from './components/article-composer'
import { ArticleViewer } from './components/article-viewer'
import type { SelectionState } from './utils'

type ParseErrorState = {
  message: string
} | null;

type TranslationState = Map<number, TranslateParagraphOutput>
type EditorState = UpsertArticleInput
const TRANSLATION_CONFIG_ID_STORAGE_KEY = 'yomilens.translation-config-id'
const TRANSLATION_MODEL_STORAGE_KEY_PREFIX = 'yomilens.translation-model'

function getModelStorageKey(configId: string) {
  return `${TRANSLATION_MODEL_STORAGE_KEY_PREFIX}.${configId}`
}

function getTranslationsFromDetail(detail: ArticleDetail | null): TranslationState {
  const paragraphs = detail?.latestProcess?.translation?.paragraphs ?? []
  return new Map(paragraphs.map((item, index) => [index, item]))
}

export function HomePage() {
  const [articles, setArticles] = useState<ArticleListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ArticleDetail | null>(null)
  const [editor, setEditor] = useState<EditorState>({
    title: '',
    text: '',
    tags: [],
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ArticleListItem | null>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<ParseErrorState>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionState>(null)
  const [translations, setTranslations] = useState<TranslationState>(new Map())
  const [translating, setTranslating] = useState(false)
  const [translateConfig, setTranslateConfig] = useState<TranslateConfigResponse | null>(null)
  const [selectedTranslateConfigId, setSelectedTranslateConfigId] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return window.localStorage.getItem(TRANSLATION_CONFIG_ID_STORAGE_KEY) ?? ''
  })
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    const selectedConfigId = window.localStorage.getItem(TRANSLATION_CONFIG_ID_STORAGE_KEY) ?? ''
    return selectedConfigId ? window.localStorage.getItem(getModelStorageKey(selectedConfigId)) ?? '' : ''
  })
  const [loadingModels, setLoadingModels] = useState(false)
  const activeConfigId = selectedTranslateConfigId || translateConfig?.defaultConfigId || ''
  const lastDetailKeyRef = useRef<string>('')

  useEffect(() => {
    void loadArticles()
    void loadTranslateConfig()
  }, [])

  useEffect(() => {
    if (!detail) {
      lastDetailKeyRef.current = ''
      setSelection(null)
      setTranslations(new Map())
      return
    }

    const nextDetailKey = [
      detail.article.id,
      detail.article.updatedAt,
      detail.latestProcess?.id ?? 'no-process',
      detail.latestProcess?.updatedAt ?? 'no-process-update',
    ].join(':')
    const previousDetailKey = lastDetailKeyRef.current
    const articleChanged = !previousDetailKey || previousDetailKey !== nextDetailKey

    setEditor({
      title: detail.article.title,
      text: detail.article.text,
      tags: detail.article.tags,
    })

    if (articleChanged) {
      setTranslations(getTranslationsFromDetail(detail))
      setSelection(null)
    }

    lastDetailKeyRef.current = nextDetailKey
  }, [detail])

  useEffect(() => {
    if (!status) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setStatus(null)
    }, 2500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [status])

  useEffect(() => {
    if (!selectedTranslateConfigId) {
      return
    }

    window.localStorage.setItem(TRANSLATION_CONFIG_ID_STORAGE_KEY, selectedTranslateConfigId)
  }, [selectedTranslateConfigId])

  useEffect(() => {
    if (!translateConfig) {
      return
    }

    const hasSelection = translateConfig.configs.some((item) => item.id === selectedTranslateConfigId)
    if (!hasSelection) {
      setSelectedTranslateConfigId(translateConfig.defaultConfigId)
    }
  }, [translateConfig, selectedTranslateConfigId])

  useEffect(() => {
    if (!translateConfig) {
      return
    }

    const configId = selectedTranslateConfigId || translateConfig.defaultConfigId
    const currentConfig = translateConfig.configs.find((item) => item.id === configId)

    setAvailableModels([])
    if (typeof window === 'undefined') {
      setSelectedModel(currentConfig?.model ?? '')
      return
    }

    const storedModel = window.localStorage.getItem(getModelStorageKey(configId))
    setSelectedModel(storedModel ?? currentConfig?.model ?? '')
  }, [translateConfig, selectedTranslateConfigId])

  useEffect(() => {
    if (typeof window === 'undefined' || !translateConfig) {
      return
    }

    const configId = selectedTranslateConfigId || translateConfig.defaultConfigId
    if (!configId) {
      return
    }

    window.localStorage.setItem(getModelStorageKey(configId), selectedModel)
  }, [translateConfig, selectedTranslateConfigId, selectedModel])

  useEffect(() => {
    if (!translateConfig || !activeConfigId) {
      return
    }

    void loadModels(activeConfigId)
  }, [translateConfig, activeConfigId])

  async function loadArticles(nextSelectedId?: string) {
    try {
      const result = await api.listArticles()
      setArticles(result.articles)
      const targetId = nextSelectedId ?? selectedId ?? result.articles[0]?.id ?? null

      if (targetId) {
        await loadArticle(targetId)
      } else {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载文章失败'
      setError({ message })
    }
  }

  async function loadArticle(id: string) {
    try {
      const nextDetail = await api.getArticle(id)
      setSelectedId(id)
      setDetail(nextDetail)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载文章详情失败'
      setError({ message })
    }
  }

  async function loadTranslateConfig() {
    try {
      const result = await api.getTranslateConfig()
      setTranslateConfig(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载翻译模型配置失败'
      setError({ message })
    }
  }

  async function loadModels(configId = activeConfigId) {
    if (!configId) {
      return
    }

    setLoadingModels(true)
    try {
      const result = await api.getTranslateModels(configId)
      setAvailableModels(result.models)
      if (result.models.length > 0) {
        setSelectedModel((current) => {
          if (current && result.models.includes(current)) {
            return current
          }

          if (typeof window !== 'undefined') {
            const storedModel = window.localStorage.getItem(getModelStorageKey(configId))
            if (storedModel && result.models.includes(storedModel)) {
              return storedModel
            }
          }

          return result.models[0]
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取模型列表失败'
      setError({ message })
    } finally {
      setLoadingModels(false)
    }
  }

  function getEditorPayload(): UpsertArticleInput | null {
    const text = editor.text.trim()
    if (!text) {
      setError({ message: '请提供文章原文。' })
      return null
    }

    return {
      title: editor.title.trim() || '未命名文章',
      text,
      tags: editor.tags,
    }
  }

  async function persistArticle(payload: UpsertArticleInput) {
    const nextDetail = detail?.article
      ? await api.updateArticle(detail.article.id, payload)
      : await api.createArticle(payload)
    setDetail(nextDetail)
    setSelectedId(nextDetail.article.id)
    await loadArticles(nextDetail.article.id)
    return nextDetail
  }

  async function handleDeleteArticle(articleId: string) {
    try {
      setDeleting(true)
      setError(null)
      setStatus(null)

      await api.deleteArticle(articleId)

      const remainingArticles = articles.filter((item) => item.id !== articleId)
      const nextSelectedId = remainingArticles[0]?.id ?? null

      setArticles(remainingArticles)
      setSelectedId(nextSelectedId)
      setDetail(null)
      setSelection(null)
      setTranslations(new Map())

      if (nextSelectedId) {
        await loadArticle(nextSelectedId)
      } else {
        setEditor({
          title: '',
          text: '',
          tags: [],
        })
      }

      setStatus('文章已删除。')
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除文章失败'
      setError({ message })
    } finally {
      setPendingDelete(null)
      setDeleting(false)
    }
  }

  async function translateArticle(articleId: string, article: ParsedArticle) {
    setTranslating(true)
    const newTranslations = new Map<number, TranslateParagraphOutput>()
    let currentMemory: TranslationMemory | Record<string, never> = {}
    const activeConfig = translateConfig?.configs.find(
      (item) => item.id === (selectedTranslateConfigId || translateConfig.defaultConfigId)
    )

    try {
      for (let i = 0; i < article.paragraphs.length; i++) {
        const paragraph = article.paragraphs[i]
        const recentContext = getRecentContext(article, newTranslations, i)

        console.log(`[Frontend] Translating paragraph ${i}...`)

        const result = await api.translateParagraph({
          currentParagraphIndex: i,
          memory: currentMemory,
          recentContext,
          currentParagraph: {
            sentences: paragraph.sentences.map((sentence, sentenceIndex) => ({
              sentenceIndex,
              text: sentence.originalText,
            })),
          },
          configId: selectedTranslateConfigId || translateConfig?.defaultConfigId,
          model: selectedModel || undefined,
        })

        console.log(`[Frontend] Paragraph ${i} translated successfully`)
        newTranslations.set(i, result)
        currentMemory = result.memory
        setTranslations(new Map(newTranslations))
      }

      if (!activeConfig) {
        throw new Error('翻译配置不存在')
      }

      const paragraphs = Array.from(newTranslations.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([, value]) => value)

      const savedDetail = await api.saveArticleTranslation(articleId, {
        paragraphs,
        memory: currentMemory as Record<string, unknown>,
        provider: activeConfig.provider as TranslationModelProvider,
        model: selectedModel,
      })

      setDetail(savedDetail)
      setTranslations(getTranslationsFromDetail(savedDetail))
      console.log('[Frontend] All paragraphs translated')
    } catch (err) {
      const message = err instanceof Error ? err.message : '翻译失败'
      console.error(`[Frontend] Translation error: ${message}`)
      setError({ message })
      throw err
    } finally {
      setTranslating(false)
    }
  }

  async function handleParse() {
    const payload = getEditorPayload()
    if (!payload) return

    try {
      setParsing(true)
      setSaving(true)
      setError(null)
      setStatus(null)

      const saved = await persistArticle(payload)
      const parsed = await api.parseStoredArticle(saved.article.id)
      setDetail(parsed)
      setStatus('文章已保存并完成解析。')
      await loadArticles(saved.article.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : '解析失败'
      setError({ message })
    } finally {
      setSaving(false)
      setParsing(false)
    }
  }

  async function handleTranslate() {
    const payload = getEditorPayload()
    if (!payload) return

    try {
      setSaving(true)
      setError(null)
      setStatus(null)
      setTranslations(new Map())

      const saved = await persistArticle(payload)
      let article = saved.latestProcess?.parse ?? null

      if (!article) {
        const parsed = await api.parseStoredArticle(saved.article.id)
        setDetail(parsed)
        if (!parsed.latestProcess?.parse) {
          throw new Error('解析结果为空')
        }
        article = parsed.latestProcess.parse
      }

      await translateArticle(saved.article.id, article)
      setStatus('文章已完成翻译。')
      await loadArticles(saved.article.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : '翻译失败'
      setError({ message })
    } finally {
      setSaving(false)
    }
  }

  function getRecentContext(
    article: ParsedArticle,
    translations: TranslationState,
    currentIndex: number
  ): Array<{ paragraphIndex: number; originalText: string; translation: string }> {
    const context: Array<{ paragraphIndex: number; originalText: string; translation: string }> = []

    for (let i = Math.max(0, currentIndex - 2); i < currentIndex; i++) {
      const translation = translations.get(i)
      if (translation && article.paragraphs[i]) {
        const paragraphTranslation = translation.sentences
          .map((s) => s.translation)
          .join("")
        context.push({
          paragraphIndex: i,
          originalText: article.paragraphs[i].originalText,
          translation: paragraphTranslation,
        })
      }
    }
    
    return context
  }

  return (
    <section className="flex flex-col gap-6 lg:flex-row">
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文章</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `将删除《${pendingDelete.title}》。` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || !pendingDelete}
              onClick={(event) => {
                event.preventDefault()
                if (!pendingDelete) {
                  return
                }
                void handleDeleteArticle(pendingDelete.id)
              }}
            >
              {deleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {status ? (
        <div className="pointer-events-none fixed right-6 top-6 z-50 w-[min(24rem,calc(100vw-3rem))]">
          <Alert className="border-primary/15 bg-popover/95 shadow-[0_20px_50px_hsl(var(--panel-shadow)/0.16)] backdrop-blur" variant="success">
            <AlertTitle>状态</AlertTitle>
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <aside className="h-fit rounded-[28px] border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-panel backdrop-blur-[14px] lg:sticky lg:top-6 lg:w-[320px] lg:shrink-0">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary/80">文章</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              className="py-2 text-sm"
              type="button"
              onClick={() => {
                setSelectedId(null)
                setDetail(null)
                setEditor({
                  title: '',
                  text: '',
                  tags: [],
                })
                setSelection(null)
                setTranslations(new Map())
                setStatus('已新建文章。')
                setError(null)
              }}
            >
              新建
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          {articles.map((item) => (
            <div
              key={item.id}
              className={cn(
                'group flex items-center gap-1 rounded-2xl',
                selectedId === item.id && 'text-foreground',
              )}
            >
              <Button
                variant="ghost"
                className={cn(
                  'relative min-h-11 flex-1 justify-start rounded-2xl border border-transparent bg-transparent pl-5 pr-2 py-2.5 text-left text-sidebar-foreground shadow-none hover:bg-transparent focus-visible:bg-transparent active:bg-transparent before:absolute before:left-1.5 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary/30 before:opacity-0 hover:text-primary hover:before:opacity-100',
                  item.title === '未命名文章' && 'text-muted-foreground',
                  selectedId === item.id
                    ? 'font-semibold text-foreground before:opacity-100 before:bg-primary/45'
                    : '',
                )}
                type="button"
                onClick={() => void loadArticle(item.id)}
              >
                <span className="truncate text-sm font-semibold">{item.title}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground opacity-0 transition-opacity hover:bg-transparent hover:text-destructive focus-visible:bg-transparent focus-visible:text-destructive group-hover:opacity-100"
                type="button"
                aria-label={`删除${item.title}`}
                disabled={saving || parsing || translating || deleting}
                onClick={(event) => {
                  event.stopPropagation()
                  setPendingDelete(item)
                }}
              >
                删除
              </Button>
            </div>
          ))}
          {articles.length === 0 ? (
            <div className="px-1 pt-3 text-sm leading-6 text-muted-foreground">数据库里还没有文章，先新建一篇。</div>
          ) : null}
        </div>
        {translateConfig ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-sidebar-border/80 pt-4">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary/80">翻译模型</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80">Provider</span>
              <Select
                value={selectedTranslateConfigId || translateConfig.defaultConfigId}
                onValueChange={setSelectedTranslateConfigId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 Provider" />
                </SelectTrigger>
                <SelectContent>
                  {translateConfig.configs.map((item) => (
                    <SelectItem value={item.id} key={item.id}>
                      {item.label} ({item.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80">Model</span>
              {availableModels.length > 0 ? (
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择 Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem value={model} key={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadModels()}
                  disabled={loadingModels}
                  className="h-11 rounded-2xl border border-input bg-background/90 px-4 text-sm text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                >
                  {loadingModels ? '获取中...' : '点击获取模型列表'}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col gap-6">
        <ArticleComposer
          article={detail?.article ?? null}
          title={editor.title}
          text={editor.text}
          tags={editor.tags}
          saving={saving}
          parsing={parsing}
          translating={translating}
          errorMessage={error?.message ?? null}
          onParse={handleParse}
          onTranslate={handleTranslate}
          onTitleChange={(value) => setEditor((current) => ({ ...current, title: value }))}
          onTextChange={(value) => setEditor((current) => ({ ...current, text: value }))}
          onTagsChange={(value) => setEditor((current) => ({ ...current, tags: value }))}
        />
        <ArticleViewer
          currentArticle={detail?.article ?? null}
          article={detail?.latestProcess?.parse ?? null}
          selection={selection}
          translations={translations}
          onSelectChunk={setSelection}
        />
      </section>
    </section>
  )
}
