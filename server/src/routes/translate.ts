import { Hono } from "hono";
import {
  findTranslationConfig,
  getTranslateConfigResponse,
} from "../lib/translate/config.ts";

export const translateRouter = new Hono();

async function tryFetchOpenAIModels(baseUrl: string, apiKey?: string): Promise<string[] | null> {
  const modelsUrl = `${baseUrl.replace(/\/+$/, "")}/models`;
  const response = await fetch(modelsUrl, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as { data?: Array<{ id?: string }> };
  return data.data
    ?.map((item) => item.id?.trim())
    .filter((item): item is string => Boolean(item)) ?? [];
}

async function tryFetchOllamaModels(baseUrl: string, apiKey?: string): Promise<string[] | null> {
  const modelsUrl = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const response = await fetch(`${modelsUrl}/api/tags`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as { models?: Array<{ name?: string }> };
  return data.models
    ?.map((item) => item.name?.trim())
    .filter((item): item is string => Boolean(item)) ?? [];
}

translateRouter.get("/config", (c) => {
  return c.json(getTranslateConfigResponse());
});

translateRouter.get("/models", async (c) => {
  const config = findTranslationConfig(c.req.query("provider"));

  if (!config?.baseUrl) {
    return c.json({ error: "未配置 Base URL" }, 400);
  }

  if (config.provider === "deepseek") {
    return c.json({
      models: ["deepseek-chat", "deepseek-coder"],
      provider: config.provider,
    });
  }

  try {
    const models =
      (await tryFetchOpenAIModels(config.baseUrl, config.apiKey)) ??
      (await tryFetchOllamaModels(config.baseUrl, config.apiKey));

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
