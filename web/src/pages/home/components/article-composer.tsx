import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
    <Card className="overflow-visible">
      <CardHeader className="mb-4 flex flex-col items-start justify-between gap-4 pb-0 sm:flex-row">
        <div>
          <CardTitle className="text-2xl text-foreground">文章信息</CardTitle>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button className="py-1.5" type="submit" form="article-composer-form" disabled={saving}>
            {saving ? '保存中…' : article ? '保存修改' : '创建文章'}
          </Button>
          <Button className="py-1.5" type="button" onClick={() => void onParse()} disabled={parsing || !article}>
            {parsing ? '解析中…' : '保存并解析'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form id="article-composer-form" onSubmit={onSubmit}>
          <div className="mb-4 grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80" htmlFor="article-title">
                标题
              </label>
              <div className="grid gap-2">
                <Input
                  id="article-title"
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder="例如：渋谷の朝にある小さな変化"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80" htmlFor="article-tags">
                标签
              </label>
              <div className="grid gap-2">
                <div className="flex items-stretch gap-2.5">
                  <Input
                    id="article-tags"
                    className="min-w-0"
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
                  <Button className="h-11 shrink-0 px-4 py-0" type="button" onClick={addTag}>
                    添加
                  </Button>
                </div>
                <div className="mt-1 flex min-h-8 flex-wrap gap-2.5">
                  {tags.length > 0 ? (
                    tags.map((tag) => (
                      <Badge className="gap-2 pr-2" variant="secondary" key={tag}>
                        <span>{tag}</span>
                        <button
                          className="bg-transparent p-0 leading-none text-inherit"
                          type="button"
                          onClick={() => onTagsChange(tags.filter((item) => item !== tag))}
                        >
                          ×
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <p className="m-0 text-sm leading-6 text-muted-foreground">还没有标签。</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80">原文</span>
            <Textarea
              className="min-h-[164px] leading-7"
              value={sourceText}
              onChange={(event) => onSourceTextChange(event.target.value)}
              placeholder="在这里粘贴日语文章"
              rows={10}
            />
          </label>
          {errorMessage ? (
            <Alert className="mt-3.5" variant="destructive">
              <AlertTitle>错误</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
