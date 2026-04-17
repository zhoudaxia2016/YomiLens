import { Hono } from "hono";
import {
  createArticle,
  getArticleDetail,
  listArticles,
  saveArticleParse,
  updateArticle,
} from "../db/articlesRepo.ts";
import { parseArticle } from "../lib/parser/index.ts";

type ParseRequest = {
  text: string;
};

type UpsertArticleRequest = {
  title?: string;
  sourceText?: string;
  tags?: string[];
};

export const articlesRouter = new Hono();

articlesRouter.get("/", async (c) => {
  const articles = await listArticles();
  return c.json({ articles });
});

articlesRouter.post("/", async (c) => {
  let payload: UpsertArticleRequest;

  try {
    payload = await c.req.json<UpsertArticleRequest>();
  } catch {
    return c.json({ error: "请求体必须是合法 JSON" }, 400);
  }

  const sourceText = payload.sourceText?.trim() ?? "";
  const title = payload.title?.trim() || "未命名文章";
  const tags = Array.isArray(payload.tags) ? payload.tags : [];

  if (!sourceText) {
    return c.json({ error: "请提供文章原文" }, 400);
  }

  const detail = await createArticle({ title, sourceText, tags });
  return c.json(detail, 201);
});

articlesRouter.get("/:id", async (c) => {
  const detail = await getArticleDetail(c.req.param("id"));

  if (!detail) {
    return c.json({ error: "文章不存在" }, 404);
  }

  return c.json(detail);
});

articlesRouter.put("/:id", async (c) => {
  let payload: UpsertArticleRequest;

  try {
    payload = await c.req.json<UpsertArticleRequest>();
  } catch {
    return c.json({ error: "请求体必须是合法 JSON" }, 400);
  }

  const sourceText = payload.sourceText?.trim() ?? "";
  const title = payload.title?.trim() || "未命名文章";
  const tags = Array.isArray(payload.tags) ? payload.tags : [];

  if (!sourceText) {
    return c.json({ error: "请提供文章原文" }, 400);
  }

  const detail = await updateArticle(c.req.param("id"), { title, sourceText, tags });
  if (!detail) {
    return c.json({ error: "文章不存在" }, 404);
  }

  return c.json(detail);
});

articlesRouter.post("/:id/parse", async (c) => {
  const detail = await getArticleDetail(c.req.param("id"));

  if (!detail) {
    return c.json({ error: "文章不存在" }, 404);
  }

  const text = detail.article.sourceText.trim();
  if (!text) {
    return c.json({ error: "文章原文不能为空" }, 400);
  }

  try {
    const article = await parseArticle(text);
    const updatedDetail = await saveArticleParse(
      detail.article.id,
      article,
      JSON.stringify(article),
    );

    return c.json(updatedDetail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return c.json({ error: message }, 500);
  }
});

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
