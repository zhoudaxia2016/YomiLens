import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import type { ParsedArticle, TranslationMemory, TranslateParagraphOutput } from '@/types'
import { ArticleComposer } from './components/article-composer'
import { ArticleViewer } from './components/article-viewer'
import { mockArticleText } from './mock-article'
import { findInitialSelection, type SelectionState } from './utils'

type ParseErrorState = {
  message: string
} | null;

type TranslationState = Map<number, TranslateParagraphOutput>

export function HomePage() {
  const [input, setInput] = useState(mockArticleText)
  const [article, setArticle] = useState<ParsedArticle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ParseErrorState>(null)
  const [selection, setSelection] = useState<SelectionState>(null)
  const [translations, setTranslations] = useState<TranslationState>(new Map())
  const [memory, setMemory] = useState<TranslationMemory | null>(null)
  const [translating, setTranslating] = useState(false)

  async function requestParse(text: string) {
    const trimmed = text.trim()
    if (!trimmed) {
      setError({ message: '请输入要解析的日语文章。' })
      return
    }

    setLoading(true)
    setError(null)
    setTranslations(new Map())
    setMemory(null)

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

  async function handleTranslate() {
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
          translations={translations}
          translating={translating}
          onSelectChunk={setSelection}
          onTranslate={handleTranslate}
        />
      </section>
    </section>
  )
}
