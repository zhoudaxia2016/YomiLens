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
  ArticleRecord,
  ArticleListItem,
  ParsedArticle,
  StoredTranslatedParagraph,
  TranslateConfigResponse,
  UpsertArticleInput,
} from '@/types'
import { ArticleComposer } from './components/article-composer'
import { ArticleViewer } from './components/article-viewer'
import type { SelectionState } from './utils'

type ParseErrorState = {
  message: string
} | null;

type TranslationState = Map<number, StoredTranslatedParagraph>
type EditorState = UpsertArticleInput
type TranslateProgressState = {
  completed: number
  total: number
} | null
const TRANSLATION_PROVIDER_STORAGE_KEY = 'yomilens.translation-provider'
const TRANSLATION_MODEL_STORAGE_KEY_PREFIX = 'yomilens.translation-model'

function getModelStorageKey(provider: string) {
  return `${TRANSLATION_MODEL_STORAGE_KEY_PREFIX}.${provider}`
}

function getTranslationsFromDetail(detail: ArticleDetail | null): TranslationState {
  const paragraphs = detail?.latestProcess?.translation?.paragraphs ?? []
  return new Map(paragraphs.map((item, index) => [index, item]))
}

function createStreamingTranslation(sentences: string[]): StoredTranslatedParagraph {
  return {
    sentences,
  }
}

export function HomePage() {
  const [articles, setArticles] = useState<ArticleListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [currentArticle, setCurrentArticle] = useState<ArticleRecord | null>(null)
  const [parsedArticle, setParsedArticle] = useState<ParsedArticle | null>(null)
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
  const [translateProgress, setTranslateProgress] = useState<TranslateProgressState>(null)
  const [translateConfig, setTranslateConfig] = useState<TranslateConfigResponse | null>(null)
  const [selectedTranslateProvider, setSelectedTranslateProvider] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return window.localStorage.getItem(TRANSLATION_PROVIDER_STORAGE_KEY) ?? ''
  })
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    const selectedProvider = window.localStorage.getItem(TRANSLATION_PROVIDER_STORAGE_KEY) ?? ''
    return selectedProvider ? window.localStorage.getItem(getModelStorageKey(selectedProvider)) ?? '' : ''
  })
  const [loadingModels, setLoadingModels] = useState(false)
  const activeProvider = selectedTranslateProvider || translateConfig?.providers[0]?.provider || ''
  const lastArticleKeyRef = useRef<string>('')

  useEffect(() => {
    void loadArticles()
    void loadTranslateConfig()
  }, [])

  useEffect(() => {
    if (!currentArticle) {
      lastArticleKeyRef.current = ''
      setSelection(null)
      return
    }

    const nextArticleKey = [
      currentArticle.id,
      currentArticle.updatedAt,
    ].join(':')
    const previousArticleKey = lastArticleKeyRef.current
    const articleChanged = !previousArticleKey || previousArticleKey !== nextArticleKey

    setEditor({
      title: currentArticle.title,
      text: currentArticle.text,
      tags: currentArticle.tags,
    })

    if (articleChanged) {
      setSelection(null)
    }

    lastArticleKeyRef.current = nextArticleKey
  }, [currentArticle])

  function applyDetail(nextDetail: ArticleDetail | null) {
    setCurrentArticle(nextDetail?.article ?? null)
    setParsedArticle(nextDetail?.latestProcess?.parse ?? null)
    setTranslations(getTranslationsFromDetail(nextDetail))
    setSelection(null)
  }

  function upsertArticleListItem(id: string, title: string) {
    setArticles((current) => {
      const existingIndex = current.findIndex((item) => item.id === id)
      if (existingIndex === -1) {
        return [{ id, title }, ...current]
      }

      const next = [...current]
      next[existingIndex] = { ...next[existingIndex], title }
      return next
    })
  }

  function applyLocalArticleDraft(id: string, payload: UpsertArticleInput) {
    setCurrentArticle((current) => current && current.id === id
      ? {
          ...current,
          title: payload.title,
          text: payload.text,
          tags: payload.tags,
        }
      : current)
    upsertArticleListItem(id, payload.title)
  }

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
    if (!selectedTranslateProvider) {
      return
    }

    window.localStorage.setItem(TRANSLATION_PROVIDER_STORAGE_KEY, selectedTranslateProvider)
  }, [selectedTranslateProvider])

  useEffect(() => {
    if (!translateConfig) {
      return
    }

    const hasSelection = translateConfig.providers.some((item) => item.provider === selectedTranslateProvider)
    if (!hasSelection) {
      setSelectedTranslateProvider(translateConfig.providers[0]?.provider ?? '')
    }
  }, [translateConfig, selectedTranslateProvider])

  useEffect(() => {
    if (!translateConfig) {
      return
    }

    const provider = selectedTranslateProvider || translateConfig.providers[0]?.provider || ''
    const currentConfig = translateConfig.providers.find((item) => item.provider === provider)

    setAvailableModels([])
    if (typeof window === 'undefined') {
      setSelectedModel(currentConfig?.model ?? '')
      return
    }

    const storedModel = provider ? window.localStorage.getItem(getModelStorageKey(provider)) : null
    setSelectedModel(storedModel ?? currentConfig?.model ?? '')
  }, [translateConfig, selectedTranslateProvider])

  useEffect(() => {
    if (typeof window === 'undefined' || !translateConfig) {
      return
    }

    const provider = selectedTranslateProvider || translateConfig.providers[0]?.provider || ''
    if (!provider) {
      return
    }

    window.localStorage.setItem(getModelStorageKey(provider), selectedModel)
  }, [translateConfig, selectedTranslateProvider, selectedModel])

  useEffect(() => {
    if (!translateConfig || !activeProvider) {
      return
    }

    void loadModels(activeProvider)
  }, [translateConfig, activeProvider])

  async function loadArticles(nextSelectedId?: string) {
    try {
      const result = await api.listArticles()
      setArticles(result.articles)
      const targetId = nextSelectedId ?? selectedId ?? result.articles[0]?.id ?? null

      if (targetId) {
        await loadArticle(targetId)
      } else {
        setSelectedId(null)
        applyDetail(null)
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
      applyDetail(nextDetail)
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

  async function loadModels(provider = activeProvider) {
    if (!provider) {
      return
    }

    setLoadingModels(true)
    try {
      const result = await api.getTranslateModels(provider)
      setAvailableModels(result.models)
      if (result.models.length > 0) {
        setSelectedModel((current) => {
          if (current && result.models.includes(current)) {
            return current
          }

          if (typeof window !== 'undefined') {
            const storedModel = window.localStorage.getItem(getModelStorageKey(provider))
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

  function applyParsedArticle(parse: ParsedArticle) {
    setParsedArticle(parse)
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
    const nextDetail = currentArticle
      ? await api.updateArticle(currentArticle.id, payload)
      : await api.createArticle(payload)
    applyDetail(nextDetail)
    setSelectedId(nextDetail.article.id)
    upsertArticleListItem(nextDetail.article.id, nextDetail.article.title)
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
      applyDetail(null)
      setSelection(null)
      setTranslateProgress(null)

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

  async function handleParse() {
    const payload = getEditorPayload()
    if (!payload) return

    try {
      setParsing(true)
      setSaving(true)
      setError(null)
      setStatus(null)

      if (!currentArticle) {
        const saved = await persistArticle(payload)
        const parsed = await api.parseStoredArticle(saved.article.id)
        applyParsedArticle(parsed.parse)
        setStatus('文章已保存并完成解析。')
        return
      }

      applyLocalArticleDraft(currentArticle.id, payload)
      const parsed = await api.parseStoredArticle(currentArticle.id, payload)
      applyParsedArticle(parsed.parse)
      setStatus('文章已保存并完成解析。')
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
    if (!activeProvider) {
      setError({ message: '请选择翻译 Provider。' })
      return
    }

    try {
      setSaving(true)
      setTranslating(true)
      setTranslateProgress(null)
      setError(null)
      setStatus(null)
      setTranslations(new Map())
      const paragraphSentences: string[][] = []

      if (!currentArticle) {
        const saved = await persistArticle(payload)
        await api.translateArticle(
          saved.article.id,
          {
            provider: activeProvider as 'deepseek' | 'llama',
            model: selectedModel || undefined,
          },
          (event) => {
            if (event.type === 'start') {
              setParsedArticle(event.parse)
              setTranslateProgress({
                completed: 0,
                total: event.totalParagraphs,
              })
              return
            }

            if (event.type === 'paragraph') {
              paragraphSentences.push(event.sentences)
              setTranslations(new Map(paragraphSentences.map((sentences, index) => [index, createStreamingTranslation(sentences)])))
              setTranslateProgress((current) => current ? {
                ...current,
                completed: paragraphSentences.length,
              } : current)
              return
            }

            if (event.type === 'complete') {
              setTranslateProgress((current) => current ? {
                ...current,
                completed: current.total,
              } : current)
              return
            }

            if (event.type === 'error') {
              throw new Error(event.error)
            }
          }
        )

        setStatus('文章已完成翻译。')
        return
      }

      applyLocalArticleDraft(currentArticle.id, payload)

      await api.translateArticle(
        currentArticle.id,
        {
          title: payload.title,
          text: payload.text,
          tags: payload.tags,
          provider: activeProvider as 'deepseek' | 'llama',
          model: selectedModel || undefined,
        },
        (event) => {
          if (event.type === 'start') {
            setParsedArticle(event.parse)
            setTranslateProgress({
              completed: 0,
              total: event.totalParagraphs,
            })
            return
          }

          if (event.type === 'paragraph') {
            paragraphSentences.push(event.sentences)
            setTranslations(new Map(paragraphSentences.map((sentences, index) => [index, createStreamingTranslation(sentences)])))
            setTranslateProgress((current) => current ? {
              ...current,
              completed: paragraphSentences.length,
            } : current)
            return
          }

          if (event.type === 'complete') {
            setTranslateProgress((current) => current ? {
              ...current,
              completed: current.total,
            } : current)
            return
          }

          if (event.type === 'error') {
            throw new Error(event.error)
          }
        }
      )

      setStatus('文章已完成翻译。')
    } catch (err) {
      const message = err instanceof Error ? err.message : '翻译失败'
      setError({ message })
    } finally {
      setSaving(false)
      setTranslating(false)
      setTranslateProgress(null)
    }
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
                applyDetail(null)
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
                className="invisible h-9 w-9 shrink-0 rounded-xl text-muted-foreground opacity-0 transition-[opacity,visibility] hover:bg-transparent hover:text-destructive focus-visible:visible focus-visible:bg-transparent focus-visible:text-destructive focus-visible:opacity-100 group-hover:visible group-hover:opacity-100"
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
                value={selectedTranslateProvider || translateConfig.providers[0]?.provider || ''}
                onValueChange={setSelectedTranslateProvider}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 Provider" />
                </SelectTrigger>
                <SelectContent>
                  {translateConfig.providers.map((item) => (
                    <SelectItem value={item.provider} key={item.provider}>
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
          article={currentArticle}
          title={editor.title}
          text={editor.text}
          tags={editor.tags}
          saving={saving}
          parsing={parsing}
          translating={translating}
          translateProgressText={translateProgress ? `翻译中 ${translateProgress.completed}/${translateProgress.total}` : null}
          errorMessage={error?.message ?? null}
          onParse={handleParse}
          onTranslate={handleTranslate}
          onTitleChange={(value) => setEditor((current) => ({ ...current, title: value }))}
          onTextChange={(value) => setEditor((current) => ({ ...current, text: value }))}
          onTagsChange={(value) => setEditor((current) => ({ ...current, tags: value }))}
        />
        <ArticleViewer
          currentArticle={currentArticle}
          article={parsedArticle}
          hasProcessed={parsedArticle !== null || translations.size > 0}
          selection={selection}
          translations={translations}
          onSelectChunk={setSelection}
        />
      </section>
    </section>
  )
}
