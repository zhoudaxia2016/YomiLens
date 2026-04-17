import { Hono } from 'hono'
import { corsAllowedFrontends } from './middleware/cors.ts'
import { initDb } from './db/schema.ts'
import { rateLimit } from './middleware/rateLimit.ts'
import { safeMutatingRequests } from './middleware/safeMutating.ts'
import { articlesRouter } from './routes/articles.ts'
import { translateRouter } from './routes/translate.ts'

await initDb()

const app = new Hono()
const api = new Hono()

app.use('*', rateLimit)

app.get('/', (c) =>
  c.json({
    name: 'YomiLens API',
    status: 'ok',
  })
)

api.use('*', corsAllowedFrontends)
api.use('*', safeMutatingRequests)
api.route('/articles', articlesRouter)
api.route('/translate', translateRouter)
app.route('/api', api)

const port = 8000
console.log(`YomiLens server running on http://localhost:${port}`)

Deno.serve({ port }, app.fetch)
