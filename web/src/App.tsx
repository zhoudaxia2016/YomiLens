import { Outlet } from 'react-router-dom'

function App() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1280px] px-4 py-14 sm:px-6 sm:py-16">
      <section className="mb-6 flex flex-col gap-4">
        <h1 className="m-0 font-serif text-[clamp(44px,8vw,88px)] leading-[0.92] text-foreground">YomiLens</h1>
      </section>
      <Outlet />
    </main>
  )
}

export default App
