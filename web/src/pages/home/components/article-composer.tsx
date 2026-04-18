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
  text: string
  tags: string[]
  saving: boolean
  parsing: boolean
  translating: boolean
  errorMessage: string | null
  onParse: () => Promise<void>
  onTranslate: () => Promise<void>
  onTitleChange: (value: string) => void
  onTextChange: (value: string) => void
  onTagsChange: (value: string[]) => void
}

export function ArticleComposer({
  article: _article,
  title,
  text,
  tags,
  saving,
  parsing,
  translating,
  errorMessage,
  onParse,
  onTranslate,
  onTitleChange,
  onTextChange,
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
          <Button className="py-1.5" type="button" onClick={() => void onParse()} disabled={saving || parsing}>
            {parsing ? '解析中…' : '解析'}
          </Button>
          <Button className="py-1.5" type="button" onClick={() => void onTranslate()} disabled={saving || translating}>
            {translating ? '翻译中…' : '翻译'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form>
          <div className="mb-4 flex flex-col items-start gap-4 lg:flex-row">
            <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80" htmlFor="article-title">
                标题
              </label>
              <Input
                id="article-title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="例如：渋谷の朝にある小さな変化"
              />
            </div>
            <div className="flex w-full min-w-0 flex-col gap-2 lg:w-[40%] lg:max-w-[26rem]">
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80" htmlFor="article-tags">
                标签
              </label>
              <div className="flex flex-col gap-2">
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
                      <Badge className="gap-1.5 border-primary/15 bg-accent/75 px-2 py-1 text-foreground" variant="secondary" key={tag}>
                        <span>{tag}</span>
                        <button
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-transparent bg-background/75 p-0 text-xs leading-none text-muted-foreground transition-colors hover:border-primary/20 hover:bg-background hover:text-foreground"
                          aria-label={`移除标签 ${tag}`}
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
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary/80">原文</span>
            <Textarea
              className="min-h-[164px] leading-7"
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
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
