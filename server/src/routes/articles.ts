import { Hono } from "hono";
import { parseArticle } from "../lib/parser/index.ts";

type ParseRequest = {
  text: string;
};

export const articlesRouter = new Hono();

articlesRouter.post("/parse", async (c) => {
  let payload: ParseRequest;

  try {
    payload = await c.req.json<ParseRequest>();
  } catch {
    return c.json({ error: "请求体必须是合法 JSON" }, 400);
  }

  const text = payload.text?.trim();
  if (!text) {
    return c.json({ error: "请提供要解析的日语文章" }, 400);
  }

  try {
    const article = await parseArticle(text);
    return c.json({
      article,
      rawModelOutput: JSON.stringify(article),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return c.json({ error: message }, 500);
  }
});
