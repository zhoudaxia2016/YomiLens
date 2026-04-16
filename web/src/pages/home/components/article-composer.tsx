import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

type ArticleComposerProps = {
  input: string
  loading: boolean
  errorMessage: string | null
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onInputChange: (value: string) => void
}

export function ArticleComposer({
  input,
  loading,
  errorMessage,
  onSubmit,
  onInputChange,
}: ArticleComposerProps) {
  return (
    <Card className="composer-card">
      <CardHeader className="composer-head">
        <div>
          <p className="section-kicker">Input</p>
          <CardTitle>请求本地 parse 接口</CardTitle>
        </div>
        <Button type="submit" form="article-composer-form" disabled={loading}>
          {loading ? '解析中…' : '重新解析'}
        </Button>
      </CardHeader>
      <CardContent>
        <form id="article-composer-form" onSubmit={onSubmit}>
          <Textarea
            className="article-input"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="在这里粘贴日语文章"
            rows={7}
          />
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </form>
      </CardContent>
    </Card>
  )
}
