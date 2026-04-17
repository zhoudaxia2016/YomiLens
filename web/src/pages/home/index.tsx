import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import type {
  ArticleDetail,
  ArticleListItem,
  TranslationMemory,
  TranslateParagraphOutput,
  UpsertArticleInput,
} from '@/types'
import { ArticleComposer } from './components/article-composer'
import { ArticleViewer } from './components/article-viewer'
import { findInitialSelection, type SelectionState } from './utils'

type ParseErrorState = {
  message: string
} | null;

type TranslationState = Map<number, TranslateParagraphOutput>
type EditorState = UpsertArticleInput

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

  useEffect(() => {
    void loadArticles()
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
    setSelection(detail.latestParse ? findInitialSelection(detail.latestParse.article) : null)
  }, [detail])

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
    <section className="reader-layout">
      <aside className="library-panel">
        <div className="panel-head">
          <div>
            <p className="section-kicker">文章</p>
          </div>
          <button
            className="new-article-button"
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
          </button>
        </div>
        <div className="library-list">
          {articles.map((item) => (
            <button
              key={item.id}
              className={['library-row', selectedId === item.id ? 'library-row-active' : ''].join(' ')}
              type="button"
              onClick={() => void loadArticle(item.id)}
            >
              <span className="library-title">{item.title}</span>
            </button>
          ))}
          {articles.length === 0 ? <div className="empty-library">数据库里还没有文章，先新建一篇。</div> : null}
        </div>
      </aside>
      <section className="reader-main">
        <ArticleComposer
          article={detail?.article ?? null}
          title={editor.title}
          sourceText={editor.sourceText}
          tags={editor.tags}
          saving={saving}
          parsing={parsing}
          errorMessage={error?.message ?? null}
          statusMessage={status}
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
