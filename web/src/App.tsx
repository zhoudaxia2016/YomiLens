import { Outlet } from 'react-router-dom'
import { Header } from './layout/header'

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">日语朗读学习器</p>
        <h1>YomiLens</h1>
        <p className="lede">
          在一个阅读界面里查看分词、假名、翻译、语法提示与依存分块，用更接近朗读应用的方式学习日语文章。
        </p>
      </section>
      <Header />
      <Outlet />
    </main>
  )
}

export default App
