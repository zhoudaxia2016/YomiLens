import { Outlet } from 'react-router-dom'

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <h1>YomiLens</h1>
      </section>
      <Outlet />
    </main>
  )
}

export default App
