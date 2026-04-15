import type { ParseArticleError, ParseArticleResponse } from '../types'

export const api = {
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
}
