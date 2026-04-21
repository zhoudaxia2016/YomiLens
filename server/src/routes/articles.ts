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
  TranslateArticleInput,
  StoredTranslatedParagraph,
  TranslateStreamEvent,
  TranslateParagraphOutput,
  TranslationMemory,
} from "../lib/translate/types.ts";
import { resolveTranslationConfig } from "../lib/translate/config.ts";
import { translateParagraph } from "../lib/translate/index.ts";

type UpsertArticleRequest = {
  title?: string;
  text?: string;
  tags?: string[];
};

type TranslateRouteRequest = TranslateArticleInput & UpsertArticleRequest;

function streamEvent(event: TranslateStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

function getNormalizedArticleUpdate(
  current: {
    title: string;
    text: string;
    tags: string[];
  },
  payload: UpsertArticleRequest,
) {
  const hasTitle = typeof payload.title === "string";
  const hasText = typeof payload.text === "string";
  const hasTags = Array.isArray(payload.tags);

  if (!hasTitle && !hasText && !hasTags) {
    return null;
  }

  const title = hasTitle ? payload.title!.trim() || "未命名文章" : current.title;
  const text = hasText ? payload.text!.trim() : current.text;
  const tags = hasTags ? payload.tags! : current.tags;

  return { title, text, tags };
}

export const articlesRouter = new Hono();

const ANSI = {
  reset: "\x1b[0m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
} as const;

function colorize(color: string, text: string): string {
  return `${color}${text}${ANSI.reset}`;
}

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
  let payload: UpsertArticleRequest = {};

  try {
    payload = await c.req.json<UpsertArticleRequest>();
  } catch {
    payload = {};
  }

  let detail = await getArticleDetail(c.req.param("id"));

  if (!detail) {
    return c.json({ error: "文章不存在" }, 404);
  }

  const nextArticle = getNormalizedArticleUpdate(detail.article, payload);
  if (nextArticle) {
    if (!nextArticle.text) {
      return c.json({ error: "文章原文不能为空" }, 400);
    }

    const updated = await updateArticle(detail.article.id, nextArticle);
    if (!updated) {
      return c.json({ error: "文章不存在" }, 404);
    }
    detail = updated;
  }

  const text = detail.article.text.trim();
  if (!text) {
    return c.json({ error: "文章原文不能为空" }, 400);
  }

  try {
    const article = await parseArticle(text);
    await saveArticleParse(detail.article.id, article);
    return c.json({ parse: article });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return c.json({ error: message }, 500);
  }
});

articlesRouter.post("/:id/translate", async (c) => {
  let payload: TranslateRouteRequest;

  try {
    payload = await c.req.json<TranslateRouteRequest>();
  } catch {
    return c.json({ error: "请求体必须是合法 JSON" }, 400);
  }

  let detail = await getArticleDetail(c.req.param("id"));
  if (!detail) {
    return c.json({ error: "文章不存在" }, 404);
  }

  const nextArticle = getNormalizedArticleUpdate(detail.article, payload);
  if (nextArticle) {
    if (!nextArticle.text) {
      return c.json({ error: "文章原文不能为空" }, 400);
    }

    const updated = await updateArticle(detail.article.id, nextArticle);
    if (!updated) {
      return c.json({ error: "文章不存在" }, 404);
    }
    detail = updated;
  }

  const text = detail.article.text.trim();
  if (!text) {
    return c.json({ error: "文章原文不能为空" }, 400);
  }

  if (!payload.provider) {
    return c.json({ error: "请提供 provider" }, 400);
  }

  let parsedArticle = detail.latestProcess?.parse ?? null;
  if (!parsedArticle) {
    try {
      parsedArticle = await parseArticle(text);
      await saveArticleParse(detail.article.id, parsedArticle);
    } catch (error) {
      const message = error instanceof Error ? error.message : "解析失败";
      return c.json({ error: message }, 500);
    }
  }

  try {
    const config = resolveTranslationConfig(payload.provider, payload.model);

    if (!config.baseUrl) {
      return c.json({ error: "请配置 Base URL" }, 400);
    }

    if (!config.model) {
      return c.json({ error: "请提供模型名称" }, 400);
    }

    if (config.provider === "deepseek" && !config.apiKey) {
      return c.json({ error: "DeepSeek 需要配置 API Key" }, 400);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const paragraphs = parsedArticle?.paragraphs ?? [];
        const translatedParagraphs: TranslateParagraphOutput[] = [];
        let currentMemory: TranslationMemory | Record<string, never> = {};
        let totalPromptMs = 0;
        let totalPredictedMs = 0;

        controller.enqueue(encoder.encode(streamEvent({
          type: "start",
          totalParagraphs: paragraphs.length,
          parse: parsedArticle!,
        })));

        try {
          for (let i = 0; i < paragraphs.length; i += 1) {
            const paragraph = paragraphs[i];
            const recentContext = translatedParagraphs
              .slice(Math.max(0, translatedParagraphs.length - 2))
              .map((item, offset) => {
                const paragraphIndex = i - Math.min(2, translatedParagraphs.length) + offset;
                return {
                  paragraphIndex,
                  originalText: paragraphs[paragraphIndex]?.originalText ?? "",
                  translation: item.sentences.map((sentence) => sentence.translation).join(""),
                };
              });

            const result = await translateParagraph({
              currentParagraphIndex: i,
              memory: currentMemory,
              recentContext,
              currentParagraph: {
                sentences: paragraph.sentences.map((sentence, sentenceIndex) => ({
                  sentenceIndex,
                  text: sentence.originalText,
                })),
              },
              model: config.model,
            }, config);

            translatedParagraphs.push(result);
            currentMemory = result.memory;
            totalPromptMs += result.metrics?.promptMs ?? 0;
            totalPredictedMs += result.metrics?.predictedMs ?? 0;

            controller.enqueue(encoder.encode(streamEvent({
              type: "paragraph",
              sentences: result.sentences.map((item) => item.translation),
            })));
          }

          const storedParagraphs: StoredTranslatedParagraph[] = translatedParagraphs.map((item) => ({
            sentences: item.sentences.map((sentence) => sentence.translation),
          }));

          await saveArticleTranslation(detail.article.id, {
            paragraphs: storedParagraphs,
            memory: currentMemory,
            provider: payload.provider,
            model: config.model,
          });

          console.log(
            `[Translate Total] prompt_ms=${colorize(ANSI.yellow, totalPromptMs.toFixed(2))}, predicted_ms=${colorize(ANSI.yellow, totalPredictedMs.toFixed(2))}, total_ms=${colorize(ANSI.magenta, (totalPromptMs + totalPredictedMs).toFixed(2))}`
          );

          controller.enqueue(encoder.encode(streamEvent({
            type: "complete",
          })));
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "翻译失败";
          controller.enqueue(encoder.encode(streamEvent({
            type: "error",
            error: message,
          })));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "翻译失败";
    return c.json({ error: message }, 500);
  }
});
