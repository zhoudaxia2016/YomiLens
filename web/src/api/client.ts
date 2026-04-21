import type {
  ArticleDetail,
  ListArticlesResponse,
  ParseArticleResponse,
  TranslateConfigResponse,
  UpsertArticleInput,
  TranslateArticleInput,
  TranslateStreamEvent,
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

  async deleteArticle(id: string) {
    const res = await fetch(`/api/articles/${id}`, {
      method: 'DELETE',
    })

    if (res.status === 204) {
      return
    }

    const json = (await res.json()) as { error?: string }
    if (!res.ok) {
      throw new Error(json.error ?? `HTTP ${res.status}`)
    }
  },

  async parseStoredArticle(id: string, input?: UpsertArticleInput) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 120_000)

    try {
      const res = await fetch(`/api/articles/${id}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input ?? {}),
        signal: controller.signal,
      })
      const json = (await res.json()) as ParseArticleResponse | { error: string }
      if (!res.ok) {
        throw new Error('error' in json ? json.error : `HTTP ${res.status}`)
      }

      return json as ParseArticleResponse
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('请求超时（120 秒）')
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  },

  async translateArticle(
    id: string,
    input: TranslateArticleInput & Partial<UpsertArticleInput>,
    onEvent: (event: TranslateStreamEvent) => void
  ) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 240_000)

    try {
      const res = await fetch(`/api/articles/${id}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      })

      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      if (!res.body) {
        throw new Error('翻译响应体为空')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) {
            continue
          }
          onEvent(JSON.parse(trimmed) as TranslateStreamEvent)
        }
      }

      const tail = buffer.trim()
      if (tail) {
        onEvent(JSON.parse(tail) as TranslateStreamEvent)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('请求超时（240 秒）')
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  },

  async getTranslateConfig() {
    const res = await fetch('/api/translate/config')
    const json = (await res.json()) as TranslateConfigResponse | { error: string }
    if (!res.ok) {
      throw new Error('error' in json ? json.error : `HTTP ${res.status}`)
    }
    return json as TranslateConfigResponse
  },

  async getTranslateModels(provider?: string) {
    const search = new URLSearchParams()
    if (provider) {
      search.set('provider', provider)
    }

    const url = search.size > 0 ? `/api/translate/models?${search.toString()}` : '/api/translate/models'
    const res = await fetch(url)
    const json = (await res.json()) as { models: string[]; provider: string; error?: string }
    if (json.error) {
      throw new Error(json.error)
    }
    return json as { models: string[]; provider: string }
  },
}
