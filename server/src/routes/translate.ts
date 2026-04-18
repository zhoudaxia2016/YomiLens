import { Hono } from "hono";
import { translateParagraph } from "../lib/translate/index.ts";
import type {
  TranslateConfigResponse,
  TranslationModelConfig,
  TranslationModelProvider,
  TranslateParagraphInput,
} from "../lib/translate/types.ts";

export const translateRouter = new Hono();

type ProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
};

function getProviderConfig(provider: TranslationModelProvider): ProviderConfig {
  switch (provider) {
    case "deepseek":
      return {
        apiKey: Deno.env.get("DEEPSEEK_API_KEY"),
        baseUrl: Deno.env.get("DEEPSEEK_BASE_URL"),
      };
    case "llama":
      return {
        apiKey: Deno.env.get("LLAMA_API_KEY"),
        baseUrl: Deno.env.get("LLAMA_BASE_URL"),
      };
    default:
      return {};
  }
}

function loadTranslationConfigs(): { defaultConfigId: string; configs: TranslationModelConfig[] } {
  const raw = Deno.env.get("TRANSLATION_CONFIGS_JSON");
  
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        defaultConfigId?: string;
        configs?: Array<{
          id?: string;
          label?: string;
          provider?: string;
          baseUrl?: string;
          model?: string;
          apiKey?: string;
        }>;
      };

      const configs = (parsed.configs ?? [])
        .map((item, index): TranslationModelConfig | null => {
          const provider = (item.provider === "llama" ? "llama" : "deepseek") as TranslationModelProvider;
          const providerConfig = getProviderConfig(provider);
          const id = item.id?.trim() || `config-${index + 1}`;
          const baseUrl = item.baseUrl?.trim() || providerConfig.baseUrl;
          const model = item.model?.trim();

          if (!baseUrl) return null;

          return {
            id,
            label: item.label?.trim() || `${provider}`,
            provider,
            baseUrl,
            model: model || "",
            apiKey: item.apiKey?.trim() || providerConfig.apiKey,
          };
        })
        .filter((item): item is TranslationModelConfig => item !== null);

      if (configs.length > 0) {
        return {
          defaultConfigId: parsed.defaultConfigId || configs[0].id,
          configs,
        };
      }
    } catch (error) {
      console.error(`[Translate Route] Failed to parse TRANSLATION_CONFIGS_JSON: ${error}`);
    }
  }

  // 自动检测可用的 provider
  const configs: TranslationModelConfig[] = [];

  // 检测 Llama (本地)
  const llamaBaseUrl = Deno.env.get("LLAMA_BASE_URL");
  if (llamaBaseUrl) {
    configs.push({
      id: "llama",
      label: "本地 Llama",
      provider: "llama",
      baseUrl: llamaBaseUrl,
      model: "",
      apiKey: Deno.env.get("LLAMA_API_KEY"),
    });
  }

  // 检测 DeepSeek
  const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
  const deepseekBaseUrl = Deno.env.get("DEEPSEEK_BASE_URL");
  if (deepseekApiKey) {
    configs.push({
      id: "deepseek",
      label: "DeepSeek",
      provider: "deepseek",
      baseUrl: deepseekBaseUrl || "https://api.deepseek.com/v1",
      model: "",
      apiKey: deepseekApiKey,
    });
  }

  if (configs.length === 0) {
    // 默认配置
    configs.push({
      id: "default",
      label: "DeepSeek (默认)",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "",
      apiKey: undefined,
    });
  }

  return {
    defaultConfigId: configs[0].id,
    configs,
  };
}

function resolveTranslationConfig(payload: TranslateParagraphInput): TranslationModelConfig {
  const { defaultConfigId, configs } = loadTranslationConfigs();
  const targetId = payload.configId?.trim() || defaultConfigId;
  const baseConfig = configs.find((item) => item.id === targetId) ?? configs[0];

  return {
    ...baseConfig,
    model: payload.model || baseConfig.model,
  };
}

function findTranslationConfig(configId?: string | null): TranslationModelConfig | null {
  const { defaultConfigId, configs } = loadTranslationConfigs();
  const targetId = configId?.trim() || defaultConfigId;
  return configs.find((item) => item.id === targetId) ?? configs[0] ?? null;
}

async function tryFetchOpenAIModels(config: TranslationModelConfig): Promise<string[] | null> {
  const modelsUrl = `${config.baseUrl.replace(/\/+$/, "")}/models`;
  const response = await fetch(modelsUrl, {
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as { data?: Array<{ id?: string }> };
  const models = data.data
    ?.map((item) => item.id?.trim())
    .filter((item): item is string => Boolean(item)) ?? [];

  return models;
}

async function tryFetchOllamaModels(config: TranslationModelConfig): Promise<string[] | null> {
  const modelsUrl = config.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const response = await fetch(`${modelsUrl}/api/tags`, {
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as { models?: Array<{ name?: string }> };
  const models = data.models
    ?.map((item) => item.name?.trim())
    .filter((item): item is string => Boolean(item)) ?? [];

  return models;
}

translateRouter.get("/config", (c) => {
  const { defaultConfigId, configs } = loadTranslationConfigs();
  const response: TranslateConfigResponse = {
    defaultConfigId,
    configs: configs.map(({ id, label, provider, model }) => ({
      id,
      label,
      provider,
      model,
    })),
  };

  return c.json(response);
});

translateRouter.get("/models", async (c) => {
  const config = findTranslationConfig(c.req.query("configId"));

  if (!config?.baseUrl) {
    return c.json({ error: "未配置 Base URL" }, 400);
  }

  // DeepSeek 不支持 /api/tags，返回预设模型列表
  if (config.provider === "deepseek") {
    return c.json({
      models: ["deepseek-chat", "deepseek-coder"],
      provider: config.provider,
    });
  }

  try {
    // README 里的 llama 配置走 OpenAI 兼容接口；部分本地服务仍然只支持 Ollama 的 /api/tags。
    const models =
      (await tryFetchOpenAIModels(config)) ??
      (await tryFetchOllamaModels(config));

    if (!models) {
      return c.json({
        error: "获取模型列表失败，请确认接口支持 /models 或 /api/tags",
        models: [],
        provider: config.provider,
      });
    }

    return c.json({ models, provider: config.provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取模型列表失败";
    console.error(`[Translate Route] Failed to get models: ${message}`);
    return c.json({ 
      error: `无法连接到 ${config.baseUrl}，请确认服务是否运行`,
      models: [],
      provider: config.provider,
    });
  }
});

translateRouter.post("/paragraph", async (c) => {
  let payload: TranslateParagraphInput;
  try {
    payload = await c.req.json<TranslateParagraphInput>();
  } catch {
    return c.json({ error: "请求体必须是合法 JSON" }, 400);
  }

  if (!payload.currentParagraph?.sentences?.length) {
    return c.json({ error: "请提供要翻译的段落" }, 400);
  }

  const config = resolveTranslationConfig(payload);

  if (!config.baseUrl) {
    return c.json({ error: "请配置 Base URL" }, 400);
  }

  if (!config.model) {
    return c.json({ error: "请提供模型名称" }, 400);
  }

  if (config.provider === "deepseek" && !config.apiKey) {
    return c.json({ error: "DeepSeek 需要配置 API Key" }, 400);
  }

  try {
    const result = await translateParagraph(payload, config);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "翻译失败";
    console.error(`[Translate Route] Error: ${message}`);
    return c.json({ error: message }, 500);
  }
});
