import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  ArticleDetail,
  ArticleListItem,
  TranslateConfigResponse,
  TranslationMemory,
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

export function HomePage() {
  const [articles, setArticles] = useState<ArticleListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ArticleDetail | null>(null)
  const [editor, setEditor] = useState<EditorState>({
    title: '',
    sourceText: '',
    tags: [],
  })
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<ParseErrorState>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionState>(null)
  const [translations, setTranslations] = useState<TranslationState>(new Map())
  const [memory, setMemory] = useState<TranslationMemory | null>(null)
  const [translating, setTranslating] = useState(false)
  const [translateConfig, setTranslateConfig] = useState<TranslateConfigResponse | null>(null)
  const [selectedTranslateConfigId, setSelectedTranslateConfigId] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return window.localStorage.getItem(TRANSLATION_CONFIG_ID_STORAGE_KEY) ?? ''
  })

  useEffect(() => {
    void loadArticles()
    void loadTranslateConfig()
  }, [])

  useEffect(() => {
    if (!detail) {
      setSelection(null)
      setTranslations(new Map())
      setMemory(null)
      return
    }

    setEditor({
      title: detail.article.title,
      sourceText: detail.article.sourceText,
      tags: detail.article.tags,
    })
    setTranslations(new Map())
    setMemory(null)
    setSelection(null)
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

  function getEditorPayload(): UpsertArticleInput | null {
    const sourceText = editor.sourceText.trim()
    if (!sourceText) {
      setError({ message: '请提供文章原文。' })
      return null
    }

    return {
      title: editor.title.trim() || '未命名文章',
      sourceText,
      tags: editor.tags,
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = getEditorPayload()
    if (!payload) return

    setSaving(true)
    setError(null)
    setStatus(null)

    try {
      const nextDetail = detail?.article
        ? await api.updateArticle(detail.article.id, payload)
        : await api.createArticle(payload)
      setDetail(nextDetail)
      setSelectedId(nextDetail.article.id)
      setStatus(detail?.article ? '文章已保存。' : '文章已创建。')
      await loadArticles(nextDetail.article.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败'
      setError({ message })
    } finally {
      setSaving(false)
    }
  }

  async function handleParse() {
    const payload = getEditorPayload()
    if (!payload) return

    try {
      setParsing(true)
      setError(null)
      setStatus(null)

      let articleId = detail?.article.id ?? null
      if (!articleId) {
        const created = await api.createArticle(payload)
        articleId = created.article.id
        setDetail(created)
        setSelectedId(articleId)
      } else {
        const saved = await api.updateArticle(articleId, payload)
        setDetail(saved)
      }

      const parsed = await api.parseStoredArticle(articleId)
      setDetail(parsed)
      setStatus('文章已保存并完成解析。')
      await loadArticles(articleId)
    } catch (err) {
      const message = err instanceof Error ? err.message : '解析失败'
      setError({ message })
    } finally {
      setParsing(false)
    }
  }

  async function handleTranslate() {
    const article = detail?.latestParse?.article
    if (!article || translating) return

    setTranslating(true)
    setError(null)
    const newTranslations = new Map(translations)
    let currentMemory: TranslationMemory | Record<string, never> = memory ?? {}

    try {
      for (let i = 0; i < article.paragraphs.length; i++) {
        if (newTranslations.has(i)) continue

        const paragraph = article.paragraphs[i]
        const recentContext = getRecentContext(newTranslations, i)

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
        })

        console.log(`[Frontend] Paragraph ${i} translated successfully`)
        newTranslations.set(i, result)
        currentMemory = result.memory
        setTranslations(new Map(newTranslations))
        setMemory(result.memory)
      }
      console.log('[Frontend] All paragraphs translated')
    } catch (err) {
      const message = err instanceof Error ? err.message : '翻译失败'
      console.error(`[Frontend] Translation error: ${message}`)
      setError({ message })
    } finally {
      setTranslating(false)
    }
  }

  function getRecentContext(
    translations: TranslationState,
    currentIndex: number
  ): Array<{ paragraphIndex: number; originalText: string; translation: string }> {
    const context: Array<{ paragraphIndex: number; originalText: string; translation: string }> = []
    const article = detail?.latestParse?.article
    
    if (!article) return context

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
    <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      {status ? (
        <div className="pointer-events-none fixed right-6 top-6 z-50 w-[min(24rem,calc(100vw-3rem))]">
          <Alert className="border-primary/15 bg-popover/95 shadow-[0_20px_50px_hsl(var(--panel-shadow)/0.16)] backdrop-blur" variant="success">
            <AlertTitle>状态</AlertTitle>
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <aside className="h-fit rounded-[28px] border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-panel backdrop-blur-[14px] lg:sticky lg:top-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary/80">文章</p>
          </div>
          <Button
            className="py-2 text-sm"
            type="button"
            onClick={() => {
              setSelectedId(null)
              setDetail(null)
              setEditor({
                title: '',
                sourceText: '',
                tags: [],
              })
              setStatus('已新建文章草稿。')
              setError(null)
            }}
          >
            新建
          </Button>
        </div>
        <div className="grid gap-0.5">
          {articles.map((item) => (
            <Button
              key={item.id}
              className={cn(
                'relative min-h-11 justify-start rounded-2xl border border-transparent bg-transparent pl-5 pr-3 py-2.5 text-left text-sidebar-foreground shadow-none before:absolute before:left-1.5 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary before:opacity-0 hover:text-primary',
                item.title === '未命名文章' && 'text-muted-foreground',
                selectedId === item.id
                  ? 'font-semibold text-foreground before:opacity-100'
                  : '',
              )}
              type="button"
              onClick={() => void loadArticle(item.id)}
            >
              <span className="truncate text-sm font-semibold">{item.title}</span>
            </Button>
          ))}
          {articles.length === 0 ? (
            <div className="px-1 pt-3 text-sm leading-6 text-muted-foreground">数据库里还没有文章，先新建一篇。</div>
          ) : null}
        </div>
        {translateConfig ? (
          <div className="mt-6 grid gap-3 border-t border-sidebar-border/80 pt-4">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary/80">翻译模型</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">由服务端提供可选 provider 和 model，前端只负责切换。</p>
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80">当前模型</span>
              <select
                className="h-11 rounded-2xl border border-input bg-background/90 px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] focus:border-primary focus:bg-background focus:shadow-[0_0_0_3px_hsl(var(--brand-soft))]"
                value={selectedTranslateConfigId || translateConfig.defaultConfigId}
                onChange={(event) => setSelectedTranslateConfigId(event.target.value)}
              >
                {translateConfig.configs.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label} · {item.provider} / {item.model}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </aside>
      <section className="grid gap-6">
        <ArticleComposer
          article={detail?.article ?? null}
          title={editor.title}
          sourceText={editor.sourceText}
          tags={editor.tags}
          saving={saving}
          parsing={parsing}
          errorMessage={error?.message ?? null}
          onSubmit={handleSubmit}
          onParse={handleParse}
          onTitleChange={(value) => setEditor((current) => ({ ...current, title: value }))}
          onSourceTextChange={(value) => setEditor((current) => ({ ...current, sourceText: value }))}
          onTagsChange={(value) => setEditor((current) => ({ ...current, tags: value }))}
        />
        <ArticleViewer
          currentArticle={detail?.article ?? null}
          article={detail?.latestParse?.article ?? null}
          selection={selection}
          translations={translations}
          translating={translating}
          onSelectChunk={setSelection}
          onTranslate={handleTranslate}
        />
      </section>
    </section>
  )
}
