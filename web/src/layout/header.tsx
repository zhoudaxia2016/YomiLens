export function Header() {
  return (
    <section className="header-strip">
      <div>
        <p className="header-label">交互阅读</p>
        <h2>粘贴日语文章，按文节查看词语标注与句子结构。</h2>
      </div>
      <p className="header-meta">首屏显示本地示例，解析请求通过服务端代理调用 DeepSeek。</p>
    </section>
  )
}
