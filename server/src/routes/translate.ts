import { Hono } from "hono";
import { translateParagraph } from "../lib/translate/index.ts";
import type {
  TranslateConfigResponse,
  TranslationModelConfig,
  TranslateParagraphInput,
} from "../lib/translate/types.ts";

export const translateRouter = new Hono();

function buildDefaultTranslationConfig(): TranslationModelConfig {
  const providerEnv = (Deno.env.get("TRANSLATION_PROVIDER") || "deepseek").trim().toLowerCase();
  const provider = providerEnv === "llama" ? "llama" : "deepseek";
  return {
    id: "default",
    label: provider === "llama" ? "本地 Llama" : "DeepSeek",
    provider,
    baseUrl:
      Deno.env.get("TRANSLATION_BASE_URL") ||
      (provider === "llama" ? "http://127.0.0.1:11434/v1" : "https://api.deepseek.com/v1"),
    model:
      Deno.env.get("TRANSLATION_MODEL") ||
      (provider === "llama" ? "llama3.1:8b" : "deepseek-chat"),
    apiKey:
      Deno.env.get("TRANSLATION_API_KEY") ||
      (provider === "deepseek" ? Deno.env.get("DEEPSEEK_API_KEY") || undefined : undefined),
  };
}

function loadTranslationConfigs(): { defaultConfigId: string; configs: TranslationModelConfig[] } {
  const fallback = buildDefaultTranslationConfig();
  const raw = Deno.env.get("TRANSLATION_CONFIGS_JSON");

  if (!raw) {
    return {
      defaultConfigId: fallback.id,
      configs: [fallback],
    };
  }

  try {
    const parsed = JSON.parse(raw) as {
      defaultConfigId?: string;
      configs?: Array<Partial<TranslationModelConfig>>;
    };

    const configs = (parsed.configs ?? [])
      .map((item, index) => {
        const provider = item.provider === "llama" ? "llama" : "deepseek";
        const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `config-${index + 1}`;
        const model = typeof item.model === "string" ? item.model.trim() : "";
        const baseUrl = typeof item.baseUrl === "string" ? item.baseUrl.trim() : "";
        if (!model || !baseUrl) {
          return null;
        }

        return {
          id,
          label:
            typeof item.label === "string" && item.label.trim()
              ? item.label.trim()
              : `${provider}:${model}`,
          provider,
          baseUrl,
          model,
          apiKey: typeof item.apiKey === "string" && item.apiKey.trim() ? item.apiKey.trim() : undefined,
        } satisfies TranslationModelConfig;
      })
      .filter((item): item is TranslationModelConfig => item !== null);

    if (configs.length === 0) {
      return {
        defaultConfigId: fallback.id,
        configs: [fallback],
      };
    }

    const defaultConfigId =
      typeof parsed.defaultConfigId === "string" && configs.some((item) => item.id === parsed.defaultConfigId)
        ? parsed.defaultConfigId
        : configs[0].id;

    return { defaultConfigId, configs };
  } catch (error) {
    console.error(`[Translate Route] Failed to parse TRANSLATION_CONFIGS_JSON: ${error}`);
    return {
      defaultConfigId: fallback.id,
      configs: [fallback],
    };
  }
}

function resolveTranslationConfig(payload: TranslateParagraphInput): TranslationModelConfig {
  const { defaultConfigId, configs } = loadTranslationConfigs();
  const targetId = payload.configId?.trim() || defaultConfigId;
  return configs.find((item) => item.id === targetId) ?? configs[0];
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
    return c.json({ error: "请提供翻译模型的 Base URL" }, 400);
  }

  if (!config.model) {
    return c.json({ error: "请提供翻译模型名称" }, 400);
  }

  if (config.provider === "deepseek" && !config.apiKey) {
    return c.json({ error: "DeepSeek 需要提供 API Key" }, 400);
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
