import type {
  ArticleDetail,
  ListArticlesResponse,
  ParseArticleError,
  ParseArticleResponse,
  UpsertArticleInput,
  TranslateParagraphInput,
  TranslateParagraphOutput,
  TranslateParagraphError,
} from '../types'

export const api = {
  async listArticles() {
    const res = await fetch('/api/articles')
    const json = (await res.json()) as ListArticlesResponse | { error: string }
    if (!res.ok) {
      throw new Error('error' in json ? json.error : `HTTP ${res.status}`)
    }
    return json as ListArticlesResponse
  },

  async getArticle(id: string) {
    const res = await fetch(`/api/articles/${id}`)
    const json = (await res.json()) as ArticleDetail | { error: string }
    if (!res.ok) {
      throw new Error('error' in json ? json.error : `HTTP ${res.status}`)
    }
    return json as ArticleDetail
  },

  async createArticle(input: UpsertArticleInput) {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    const json = (await res.json()) as ArticleDetail | { error: string }
    if (!res.ok) {
      throw new Error('error' in json ? json.error : `HTTP ${res.status}`)
    }
    return json as ArticleDetail
  },

  async updateArticle(id: string, input: UpsertArticleInput) {
    const res = await fetch(`/api/articles/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    const json = (await res.json()) as ArticleDetail | { error: string }
    if (!res.ok) {
      throw new Error('error' in json ? json.error : `HTTP ${res.status}`)
    }
    return json as ArticleDetail
  },

  async parseStoredArticle(id: string) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 120_000)

    try {
      const res = await fetch(`/api/articles/${id}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: controller.signal,
      })
      const json = (await res.json()) as ArticleDetail | { error: string }
      if (!res.ok) {
        throw new Error('error' in json ? json.error : `HTTP ${res.status}`)
      }
      return json as ArticleDetail
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('请求超时（120 秒）')
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  },

  async parseArticle(text: string): Promise<ParseArticleResponse> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30_000)

    try {
      const res = await fetch('/api/articles/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })

      const json = (await res.json()) as ParseArticleResponse | ParseArticleError
      if (!res.ok) {
        const message = 'error' in json ? json.error : `HTTP ${res.status}`
        const error = new Error(message) as Error & { rawModelOutput?: string }
        error.rawModelOutput = 'rawModelOutput' in json ? json.rawModelOutput : undefined
        throw error
      }

      return json as ParseArticleResponse
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('请求超时（30 秒）')
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  },

  async translateParagraph(
    input: TranslateParagraphInput
  ): Promise<TranslateParagraphOutput> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 120_000)

    try {
      const res = await fetch('/api/translate/paragraph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      })

      const json = (await res.json()) as TranslateParagraphOutput | TranslateParagraphError
      if (!res.ok) {
        const message = 'error' in json ? json.error : `HTTP ${res.status}`
        throw new Error(message)
      }

      return json as TranslateParagraphOutput
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('请求超时（120 秒）')
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  },
}
