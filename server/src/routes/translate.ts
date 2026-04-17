import { Hono } from "hono";
import { translateParagraph } from "../lib/translate/index.ts";
import type { TranslateParagraphInput } from "../lib/translate/types.ts";

export const translateRouter = new Hono();

translateRouter.post("/paragraph", async (c) => {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  const baseUrl = Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1";
  
  if (!apiKey) {
    return c.json({ error: "DEEPSEEK_API_KEY 环境变量未设置" }, 500);
  }

  let payload: TranslateParagraphInput;
  try {
    payload = await c.req.json<TranslateParagraphInput>();
  } catch {
    return c.json({ error: "请求体必须是合法 JSON" }, 400);
  }

  if (!payload.currentParagraph?.sentences?.length) {
    return c.json({ error: "请提供要翻译的段落" }, 400);
  }

  try {
    const result = await translateParagraph(payload, apiKey, baseUrl);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "翻译失败";
    console.error(`[Translate Route] Error: ${message}`);
    return c.json({ error: message }, 500);
  }
});
