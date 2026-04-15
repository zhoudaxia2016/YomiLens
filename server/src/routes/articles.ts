import { Hono } from 'hono'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 30_000

const posValues = new Set([
  '名詞',
  '動詞',
  '形容詞',
  '形容動詞',
  '助詞',
  '助動詞',
  '副詞',
  '連体詞',
  '接続詞',
  '感動詞',
  '代名詞',
  '接頭辞',
  '接尾辞',
])

const relationValues = new Set([
  'root',
  'nsubj',
  'dobj',
  'iobj',
  'advmod',
  'aux',
  'auxpass',
  'mark',
  'case',
  'nmod',
  'amod',
  'det',
  'neg',
  'cc',
  'conj',
  'punct',
  'compound',
  'nummod',
])

const difficultyValues = new Set(['beginner', 'intermediate', 'advanced'])
const conjugationTypeValues = new Set(['五段', '一段', 'カ変', 'サ変', '形容詞', '形容動詞'])
const conjugationFormValues = new Set([
  '未然形A',
  '未然形B',
  '連用形A',
  '連用形B',
  '終止形',
  '連体形',
  '仮定形',
  '命令形',
])
const auxiliaryKindValues = new Set(['助動詞', '助詞'])

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

type ParseRequest = {
  text: string
}

export const articlesRouter = new Hono()

articlesRouter.post('/parse', async (c) => {
  let payload: ParseRequest
  try {
    payload = await c.req.json<ParseRequest>()
  } catch {
    return c.json({ error: '请求体必须是合法 JSON' }, 400)
  }

  const text = payload.text?.trim()
  if (!text) {
    return c.json({ error: '请提供要解析的日语文章' }, 400)
  }

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')?.trim()
  if (!apiKey) {
    return c.json({ error: '服务端缺少 DEEPSEEK_API_KEY 配置' }, 500)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const upstreamResponse = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '你是一个日语自然语言处理专家。请把用户提供的日语文章解析为纯 JSON，不要输出 markdown、解释、代码块或额外文字。顶层结构必须符合 ParsedArticle：title 可选，paragraphs 必填且为数组。每个 sentence 必须包含 originalText、tokens、dependencyTree；translation 和 grammarTips 可选。每个 token 必须包含 surface、lemma、reading、furigana、pos、meaning。reading 使用片假名，furigana 使用可直接渲染到 ruby 的纯文本。标点符号也要作为 token 返回。dependencyTree 必须是完整树结构，根节点 relation 为 root，children 为数组。grammarTips 若存在，需包含 point、description、difficulty、tokenIndices。所有 tokenIndices 必须是当前句子 tokens 的合法索引。输出内容必须是可直接 JSON.parse 的对象。',
          },
          {
            role: 'user',
            content: text,
          },
        ],
      }),
      signal: controller.signal,
    })

    const upstreamText = await upstreamResponse.text()
    if (!upstreamResponse.ok) {
      return c.json(
        {
          error: `DeepSeek 请求失败（HTTP ${upstreamResponse.status}）`,
          rawModelOutput: upstreamText,
        },
        502,
      )
    }

    let envelope: unknown
    try {
      envelope = JSON.parse(upstreamText)
    } catch {
      return c.json(
        {
          error: 'DeepSeek 返回了无法解析的响应',
          rawModelOutput: upstreamText,
        },
        502,
      )
    }

    const content = extractMessageContent(envelope)
    if (!content) {
      return c.json(
        {
          error: '未从 DeepSeek 响应中提取到模型输出',
          rawModelOutput: upstreamText,
        },
        502,
      )
    }

    let articleJson: unknown
    try {
      articleJson = JSON.parse(content)
    } catch {
      return c.json(
        {
          error: '模型输出不是合法 JSON',
          rawModelOutput: content,
        },
        502,
      )
    }

    const validation = validateParsedArticle(articleJson)
    if (!validation.ok) {
      return c.json(
        {
          error: `模型输出结构不符合要求：${validation.error}`,
          rawModelOutput: content,
        },
        502,
      )
    }

    return c.json({
      article: validation.value,
      rawModelOutput: content,
    })
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'DeepSeek 请求超时（30 秒）'
      : error instanceof Error
      ? error.message
      : '服务端请求 DeepSeek 时发生未知错误'

    return c.json({ error: message }, 502)
  } finally {
    clearTimeout(timeout)
  }
})

function extractMessageContent(value: unknown): string | null {
  if (!isRecord(value)) return null
  const choices = value.choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (!isRecord(first)) return null
  const message = first.message
  if (!isRecord(message)) return null
  return typeof message.content === 'string' ? message.content : null
}

function validateParsedArticle(value: unknown): ValidationResult<Record<string, unknown>> {
  if (!isRecord(value)) return invalid('顶层必须是对象')
  if (value.title !== undefined && typeof value.title !== 'string') {
    return invalid('title 必须是字符串')
  }

  const paragraphs = value.paragraphs
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    return invalid('paragraphs 必须是非空数组')
  }

  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    if (!isRecord(paragraph)) return invalid(`paragraphs[${paragraphIndex}] 必须是对象`)
    if (typeof paragraph.originalText !== 'string') {
      return invalid(`paragraphs[${paragraphIndex}].originalText 必须是字符串`)
    }
    if (!Array.isArray(paragraph.sentences) || paragraph.sentences.length === 0) {
      return invalid(`paragraphs[${paragraphIndex}].sentences 必须是非空数组`)
    }

    for (const [sentenceIndex, sentence] of paragraph.sentences.entries()) {
      const path = `paragraphs[${paragraphIndex}].sentences[${sentenceIndex}]`
      const sentenceValidation = validateSentence(sentence, path)
      if (!sentenceValidation.ok) return sentenceValidation
    }
  }

  return { ok: true, value }
}

function validateSentence(value: unknown, path: string): ValidationResult<true> {
  if (!isRecord(value)) return invalid(`${path} 必须是对象`)
  if (typeof value.originalText !== 'string') return invalid(`${path}.originalText 必须是字符串`)
  if (value.translation !== undefined && typeof value.translation !== 'string') {
    return invalid(`${path}.translation 必须是字符串`)
  }
  if (!Array.isArray(value.tokens) || value.tokens.length === 0) {
    return invalid(`${path}.tokens 必须是非空数组`)
  }

  for (const [tokenIndex, token] of value.tokens.entries()) {
    const tokenPath = `${path}.tokens[${tokenIndex}]`
    const tokenValidation = validateToken(token, tokenPath)
    if (!tokenValidation.ok) return tokenValidation
  }

  const dependencyTree = value.dependencyTree
  const treeValidation = validateDependencyNode(
    dependencyTree,
    `${path}.dependencyTree`,
    value.tokens.length,
    true,
  )
  if (!treeValidation.ok) return treeValidation

  if (value.grammarTips !== undefined) {
    if (!Array.isArray(value.grammarTips)) return invalid(`${path}.grammarTips 必须是数组`)
    for (const [tipIndex, tip] of value.grammarTips.entries()) {
      const tipValidation = validateGrammarTip(
        tip,
        `${path}.grammarTips[${tipIndex}]`,
        value.tokens.length,
      )
      if (!tipValidation.ok) return tipValidation
    }
  }

  return { ok: true, value: true }
}

function validateToken(value: unknown, path: string): ValidationResult<true> {
  if (!isRecord(value)) return invalid(`${path} 必须是对象`)
  if (typeof value.surface !== 'string') return invalid(`${path}.surface 必须是字符串`)
  if (typeof value.lemma !== 'string') return invalid(`${path}.lemma 必须是字符串`)
  if (typeof value.reading !== 'string') return invalid(`${path}.reading 必须是字符串`)
  if (typeof value.furigana !== 'string') return invalid(`${path}.furigana 必须是字符串`)
  if (typeof value.meaning !== 'string') return invalid(`${path}.meaning 必须是字符串`)
  if (typeof value.pos !== 'string' || !posValues.has(value.pos)) {
    return invalid(`${path}.pos 不在允许范围内`)
  }

  if (value.conjugation !== undefined) {
    if (!isRecord(value.conjugation)) return invalid(`${path}.conjugation 必须是对象`)
    if (
      typeof value.conjugation.type !== 'string'
      || !conjugationTypeValues.has(value.conjugation.type)
    ) {
      return invalid(`${path}.conjugation.type 不在允许范围内`)
    }
    if (
      typeof value.conjugation.form !== 'string'
      || !conjugationFormValues.has(value.conjugation.form)
    ) {
      return invalid(`${path}.conjugation.form 不在允许范围内`)
    }

    if (value.conjugation.auxiliary !== undefined) {
      const auxiliary = value.conjugation.auxiliary
      if (!isRecord(auxiliary)) return invalid(`${path}.conjugation.auxiliary 必须是对象`)
      if (typeof auxiliary.kind !== 'string' || !auxiliaryKindValues.has(auxiliary.kind)) {
        return invalid(`${path}.conjugation.auxiliary.kind 不在允许范围内`)
      }
      if (typeof auxiliary.text !== 'string') {
        return invalid(`${path}.conjugation.auxiliary.text 必须是字符串`)
      }
    }
  }

  return { ok: true, value: true }
}

function validateDependencyNode(
  value: unknown,
  path: string,
  tokenCount: number,
  isRoot = false,
): ValidationResult<true> {
  if (!isRecord(value)) return invalid(`${path} 必须是对象`)
  if (typeof value.text !== 'string') return invalid(`${path}.text 必须是字符串`)
  if (!Array.isArray(value.tokenIndices) || value.tokenIndices.length === 0) {
    return invalid(`${path}.tokenIndices 必须是非空数组`)
  }
  for (const [index, tokenIndex] of value.tokenIndices.entries()) {
    if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= tokenCount) {
      return invalid(`${path}.tokenIndices[${index}] 超出 token 范围`)
    }
  }
  if (typeof value.relation !== 'string' || !relationValues.has(value.relation)) {
    return invalid(`${path}.relation 不在允许范围内`)
  }
  if (isRoot && value.relation !== 'root') {
    return invalid(`${path}.relation 必须为 root`)
  }
  if (!Array.isArray(value.children)) return invalid(`${path}.children 必须是数组`)
  for (const [childIndex, child] of value.children.entries()) {
    const childValidation = validateDependencyNode(
      child,
      `${path}.children[${childIndex}]`,
      tokenCount,
      false,
    )
    if (!childValidation.ok) return childValidation
  }
  return { ok: true, value: true }
}

function validateGrammarTip(
  value: unknown,
  path: string,
  tokenCount: number,
): ValidationResult<true> {
  if (!isRecord(value)) return invalid(`${path} 必须是对象`)
  if (typeof value.point !== 'string') return invalid(`${path}.point 必须是字符串`)
  if (typeof value.description !== 'string') return invalid(`${path}.description 必须是字符串`)
  if (typeof value.difficulty !== 'string' || !difficultyValues.has(value.difficulty)) {
    return invalid(`${path}.difficulty 不在允许范围内`)
  }
  if (!Array.isArray(value.tokenIndices)) return invalid(`${path}.tokenIndices 必须是数组`)
  for (const [index, tokenIndex] of value.tokenIndices.entries()) {
    if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= tokenCount) {
      return invalid(`${path}.tokenIndices[${index}] 超出 token 范围`)
    }
  }
  return { ok: true, value: true }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

function invalid(error: string): ValidationResult<never> {
  return { ok: false, error }
}
