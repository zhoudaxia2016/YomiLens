import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import type { ParsedArticle } from '@/types'
import { ArticleComposer } from './components/article-composer'
import { ArticleViewer } from './components/article-viewer'
import { mockArticleText } from './mock-article'
import { findInitialSelection, type SelectionState } from './utils'

type ParseErrorState = {
  message: string
} | null;

export function HomePage() {
  const [input, setInput] = useState(mockArticleText)
  const [article, setArticle] = useState<ParsedArticle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ParseErrorState>(null)
  const [selection, setSelection] = useState<SelectionState>(null)

  async function requestParse(text: string) {
    const trimmed = text.trim()
    if (!trimmed) {
      setError({ message: '请输入要解析的日语文章。' })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await api.parseArticle(trimmed)
      setArticle(result.article)
      setSelection(findInitialSelection(result.article))
    } catch (err) {
      const message = err instanceof Error ? err.message : '解析失败'
      setError({ message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void requestParse(mockArticleText)
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await requestParse(input)
  }

  return (
    <section className="reader-layout">
      <section className="reader-main">
        <ArticleComposer
          input={input}
          loading={loading}
          errorMessage={error?.message ?? null}
          onSubmit={handleSubmit}
          onInputChange={setInput}
        />
        <ArticleViewer
          article={article}
          selection={selection}
          onSelectChunk={setSelection}
        />
      </section>
    </section>
  )
}
