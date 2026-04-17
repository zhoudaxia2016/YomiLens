import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ArticleRecord } from '@/types'

type ArticleComposerProps = {
  article: ArticleRecord | null
  title: string
  sourceText: string
  tags: string[]
  saving: boolean
  parsing: boolean
  errorMessage: string | null
  statusMessage: string | null
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onParse: () => Promise<void>
  onTitleChange: (value: string) => void
  onSourceTextChange: (value: string) => void
  onTagsChange: (value: string[]) => void
}

export function ArticleComposer({
  article,
  title,
  sourceText,
  tags,
  saving,
  parsing,
  errorMessage,
  statusMessage,
  onSubmit,
  onParse,
  onTitleChange,
  onSourceTextChange,
  onTagsChange,
}: ArticleComposerProps) {
  const [tagInput, setTagInput] = useState('')

  function addTag() {
    const next = tagInput.trim()
    if (!next) return
    if (tags.includes(next)) {
      setTagInput('')
      return
    }
    onTagsChange([...tags, next])
    setTagInput('')
  }

  return (
    <Card className="composer-card">
      <CardHeader className="composer-head">
        <div>
          <CardTitle>文章信息</CardTitle>
        </div>
        <div className="composer-actions">
          <Button type="submit" form="article-composer-form" disabled={saving}>
            {saving ? '保存中…' : article ? '保存修改' : '创建文章'}
          </Button>
          <Button type="button" onClick={() => void onParse()} disabled={parsing || !article}>
            {parsing ? '解析中…' : '保存并解析'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form id="article-composer-form" onSubmit={onSubmit}>
          <div className="field-grid">
            <label className="field-block">
              <span className="field-label">标题</span>
              <input
                className="text-input"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="例如：渋谷の朝にある小さな変化"
              />
            </label>
            <label className="field-block">
              <span className="field-label">标签</span>
              <div className="tag-editor">
                <div className="tag-input-row">
                  <Input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder="输入标签后回车或点击添加"
                  />
                  <Button type="button" onClick={addTag}>
                    添加
                  </Button>
                </div>
                <div className="tag-list">
                  {tags.length > 0 ? (
                    tags.map((tag) => (
                      <Badge className="tag-badge" variant="secondary" key={tag}>
                        <span>{tag}</span>
                        <button
                          className="tag-remove"
                          type="button"
                          onClick={() => onTagsChange(tags.filter((item) => item !== tag))}
                        >
                          ×
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <p className="muted">还没有标签。</p>
                  )}
                </div>
              </div>
            </label>
          </div>
          <label className="field-block">
            <span className="field-label">原文</span>
          </label>
          <Textarea
            className="article-input"
            value={sourceText}
            onChange={(event) => onSourceTextChange(event.target.value)}
            placeholder="在这里粘贴日语文章"
            rows={10}
          />
          {statusMessage ? <p className="status-banner">{statusMessage}</p> : null}
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </form>
      </CardContent>
    </Card>
  )
}
