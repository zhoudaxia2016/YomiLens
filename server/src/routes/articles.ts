import { Hono } from "hono";
import {
  createArticle,
  deleteArticle,
  getArticleDetail,
  listArticles,
  saveArticleParse,
  saveArticleTranslation,
  updateArticle,
} from "../db/articlesRepo.ts";
import { parseArticle } from "../lib/parser/index.ts";
import type {
  TranslateParagraphOutput,
  TranslationMemory,
  TranslationModelProvider,
} from "../lib/translate/types.ts";

type ParseRequest = {
  text: string;
};

type UpsertArticleRequest = {
  title?: string;
  text?: string;
  tags?: string[];
};

type SaveTranslationRequest = {
  paragraphs?: TranslateParagraphOutput[];
  memory?: TranslationMemory | Record<string, never>;
  provider?: TranslationModelProvider;
  model?: string;
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

  const text = payload.text?.trim() ?? "";
  const title = payload.title?.trim() || "未命名文章";
  const tags = Array.isArray(payload.tags) ? payload.tags : [];

  if (!text) {
    return c.json({ error: "请提供文章原文" }, 400);
  }

  const detail = await createArticle({ title, text, tags });
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

  const text = payload.text?.trim() ?? "";
  const title = payload.title?.trim() || "未命名文章";
  const tags = Array.isArray(payload.tags) ? payload.tags : [];

  if (!text) {
    return c.json({ error: "请提供文章原文" }, 400);
  }

  const detail = await updateArticle(c.req.param("id"), { title, text, tags });
  if (!detail) {
    return c.json({ error: "文章不存在" }, 404);
  }

  return c.json(detail);
});

articlesRouter.delete("/:id", async (c) => {
  const deleted = await deleteArticle(c.req.param("id"));

  if (!deleted) {
    return c.json({ error: "文章不存在" }, 404);
  }

  return c.body(null, 204);
});

articlesRouter.post("/:id/parse", async (c) => {
  const detail = await getArticleDetail(c.req.param("id"));

  if (!detail) {
    return c.json({ error: "文章不存在" }, 404);
  }

  const text = detail.article.text.trim();
  if (!text) {
    return c.json({ error: "文章原文不能为空" }, 400);
  }

  try {
    const article = await parseArticle(text);
    const updatedDetail = await saveArticleParse(detail.article.id, article);

    return c.json(updatedDetail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return c.json({ error: message }, 500);
  }
});

articlesRouter.post("/:id/translation", async (c) => {
  let payload: SaveTranslationRequest;

  try {
    payload = await c.req.json<SaveTranslationRequest>();
  } catch {
    return c.json({ error: "请求体必须是合法 JSON" }, 400);
  }

  if (!Array.isArray(payload.paragraphs)) {
    return c.json({ error: "请提供翻译结果" }, 400);
  }

  if (!payload.provider || !payload.model?.trim()) {
    return c.json({ error: "请提供 provider 和 model" }, 400);
  }

  const detail = await saveArticleTranslation(c.req.param("id"), {
    paragraphs: payload.paragraphs,
    memory: payload.memory ?? {},
    provider: payload.provider,
    model: payload.model.trim(),
  });

  if (!detail) {
    return c.json({ error: "文章不存在" }, 404);
  }

  return c.json(detail);
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
    return c.json({ article });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return c.json({ error: message }, 500);
  }
});
