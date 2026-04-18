# YomiLens

一个保留基础项目结构的最简全栈模板，每层只留一个示例。

## 快速开始

### 1) 启动服务端

```bash
cd server
deno task dev
```

默认监听 `http://localhost:8000`。

可选翻译模型环境变量：

```bash
TRANSLATION_PROVIDER=llama
TRANSLATION_BASE_URL=http://127.0.0.1:11434/v1
TRANSLATION_MODEL=llama3.1:8b
TRANSLATION_API_KEY=
```

如果你希望前端只能在服务端提供的模型列表里切换，可以改用：

```bash
TRANSLATION_CONFIGS_JSON='{
  "defaultConfigId": "local-llama",
  "configs": [
    {
      "id": "deepseek-chat",
      "label": "DeepSeek Chat",
      "provider": "deepseek",
      "baseUrl": "https://api.deepseek.com/v1",
      "model": "deepseek-chat",
      "apiKey": "YOUR_DEEPSEEK_KEY"
    },
    {
      "id": "local-llama",
      "label": "本地 Llama 3.1 8B",
      "provider": "llama",
      "baseUrl": "http://127.0.0.1:11434/v1",
      "model": "llama3.1:8b"
    }
  ]
}'
```

说明：

- `TRANSLATION_PROVIDER=deepseek` 时，默认走 `https://api.deepseek.com/v1`，通常需要 `TRANSLATION_API_KEY` 或 `DEEPSEEK_API_KEY`
- `TRANSLATION_PROVIDER=llama` 时，默认走本地 OpenAI 兼容接口 `http://127.0.0.1:11434/v1`
- 如果你用 Ollama 的 OpenAI 兼容模式，只需要把 `TRANSLATION_PROVIDER` 设为 `llama`，并填好 `TRANSLATION_MODEL`
- 设置 `TRANSLATION_CONFIGS_JSON` 后，前端会读取服务端提供的模型列表，只能切换现有项，不能手动新建

### 2) 启动前端

```bash
cd web
pnpm install
pnpm dev
```

默认监听 `http://localhost:3000`，开发环境通过 Vite 代理把 `/api` 转发到 `:8000`。

## 当前结构

- [server/src/main.ts](/home/zhou/code/YomiLens/server/src/main.ts:1)：服务端入口
- [server/src/routes/example.ts](/home/zhou/code/YomiLens/server/src/routes/example.ts:1)：唯一示例 route
- [web/src/App.tsx](/home/zhou/code/YomiLens/web/src/App.tsx:1)：前端应用壳
- [web/src/routes/index.tsx](/home/zhou/code/YomiLens/web/src/routes/index.tsx:1)：唯一示例 router
- [web/src/pages/home/index.tsx](/home/zhou/code/YomiLens/web/src/pages/home/index.tsx:1)：唯一示例 page
- [web/src/api/client.ts](/home/zhou/code/YomiLens/web/src/api/client.ts:1)：唯一示例 API client
- [web/src/hooks/use-example.ts](/home/zhou/code/YomiLens/web/src/hooks/use-example.ts:1)：唯一示例 hook
- [web/src/components/example-card.tsx](/home/zhou/code/YomiLens/web/src/components/example-card.tsx:1)：唯一示例 component

## 后续扩展

1. 在 `server/src/routes/` 下继续增加新的 route 模块。
2. 在 `web/src/pages/`、`web/src/components/`、`web/src/hooks/` 下继续扩展页面和逻辑。
3. 如果仓库名不是 `YomiLens`，同步修改 `web/vite.config.ts` 的生产 `base`。
