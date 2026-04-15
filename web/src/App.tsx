import { Outlet } from 'react-router-dom'

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">日语文章阅读器</p>
        <h1>YomiLens</h1>
      </section>
      <Outlet />
    </main>
  )
}

export default App
