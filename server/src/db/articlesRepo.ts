import type { Client, InStatement } from "@libsql/client";
import type { ParsedArticle } from "../lib/parser/index.ts";
import type {
  TranslateParagraphOutput,
  TranslationMemory,
  TranslationModelProvider,
} from "../lib/translate/types.ts";
import { getDbClient } from "./client.ts";

export type ArticleRecord = {
  id: string;
  title: string;
  text: string;
  tags: string[];
  latestProcessId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredArticleTranslation = {
  paragraphs: TranslateParagraphOutput[];
  memory: TranslationMemory | Record<string, never>;
};

export type ArticleProcessRecord = {
  id: string;
  articleId: string;
  text: string;
  parse: ParsedArticle | null;
  translation: StoredArticleTranslation | null;
  provider: TranslationModelProvider | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArticleListItem = {
  id: string;
  title: string;
};

export type ArticleDetail = {
  article: ArticleRecord;
  latestProcess: ArticleProcessRecord | null;
};

export type UpsertArticleInput = {
  title: string;
  text: string;
  tags: string[];
};

export type SaveArticleTranslationInput = {
  paragraphs: TranslateParagraphOutput[];
  memory: TranslationMemory | Record<string, never>;
  provider: TranslationModelProvider;
  model: string;
};

function getClient(client?: Client) {
  return client ?? getDbClient();
}

function parseTags(tagsJson: string) {
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeTags(parsed);
    }
  } catch {
    // ignore malformed legacy data
  }

  return [];
}

function normalizeTags(tags: unknown[]) {
  return Array.from(
    new Set(
      tags
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function rowToArticle(row: Record<string, unknown>): ArticleRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    text: String(row.text ?? ""),
    tags: parseTags(String(row.tags_json ?? "[]")),
    latestProcessId: row.latest_process_id ? String(row.latest_process_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToProcess(row: Record<string, unknown>): ArticleProcessRecord {
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    text: String(row.text ?? ""),
    parse: row.parse_json ? JSON.parse(String(row.parse_json)) as ParsedArticle : null,
    translation: row.translation_json
      ? JSON.parse(String(row.translation_json)) as StoredArticleTranslation
      : null,
    provider: row.provider ? String(row.provider) as TranslationModelProvider : null,
    model: row.model ? String(row.model) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function getReusableProcess(
  articleId: string,
  text: string,
  client: Client,
): Promise<ArticleProcessRecord | null> {
  const res = await client.execute({
    sql: `SELECT * FROM article_processes
          WHERE article_id = ? AND text = ?
          ORDER BY updated_at DESC
          LIMIT 1`,
    args: [articleId, text],
  });

  if (res.rows.length === 0) {
    return null;
  }

  return rowToProcess(res.rows[0] as Record<string, unknown>);
}

export async function listArticles(client?: Client): Promise<ArticleListItem[]> {
  const db = getClient(client);
  const res = await db.execute(`SELECT id, title FROM articles ORDER BY updated_at DESC`);

  return res.rows.map((row) => ({
    id: String((row as Record<string, unknown>).id),
    title: String((row as Record<string, unknown>).title),
  }));
}

export async function getArticleDetail(
  articleId: string,
  client?: Client,
): Promise<ArticleDetail | null> {
  const db = getClient(client);
  const articleRes = await db.execute({
    sql: `SELECT * FROM articles WHERE id = ?`,
    args: [articleId],
  });

  if (articleRes.rows.length === 0) {
    return null;
  }

  const article = rowToArticle(articleRes.rows[0] as Record<string, unknown>);
  let latestProcess: ArticleProcessRecord | null = null;

  if (article.latestProcessId) {
    const processRes = await db.execute({
      sql: `SELECT * FROM article_processes WHERE id = ? AND article_id = ?`,
      args: [article.latestProcessId, article.id],
    });

    if (processRes.rows.length > 0) {
      latestProcess = rowToProcess(processRes.rows[0] as Record<string, unknown>);
    }
  }

  return { article, latestProcess };
}

export async function createArticle(
  input: UpsertArticleInput,
  client?: Client,
): Promise<ArticleDetail> {
  const db = getClient(client);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tags = normalizeTags(input.tags);

  await db.execute({
    sql: `INSERT INTO articles (
      id, title, text, tags_json, latest_process_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.title, input.text, JSON.stringify(tags), null, now, now],
  });

  return {
    article: {
      id,
      title: input.title,
      text: input.text,
      tags,
      latestProcessId: null,
      createdAt: now,
      updatedAt: now,
    },
    latestProcess: null,
  };
}

export async function updateArticle(
  articleId: string,
  input: UpsertArticleInput,
  client?: Client,
): Promise<ArticleDetail | null> {
  const db = getClient(client);
  const existing = await getArticleDetail(articleId, db);

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const tags = normalizeTags(input.tags);
  const textChanged = existing.article.text !== input.text;

  await db.execute({
    sql: `UPDATE articles
          SET title = ?, text = ?, tags_json = ?, latest_process_id = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      input.title,
      input.text,
      JSON.stringify(tags),
      textChanged ? null : existing.article.latestProcessId,
      now,
      articleId,
    ],
  });

  return getArticleDetail(articleId, db);
}

export async function saveArticleParse(
  articleId: string,
  parsedArticle: ParsedArticle,
  client?: Client,
): Promise<ArticleDetail | null> {
  const db = getClient(client);
  const existing = await getArticleDetail(articleId, db);

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const reusableProcess = await getReusableProcess(articleId, existing.article.text, db);
  const processId = reusableProcess?.id ?? crypto.randomUUID();
  const statements: InStatement[] = [];

  if (reusableProcess) {
    statements.push({
      sql: `UPDATE article_processes
            SET parse_json = ?, updated_at = ?
            WHERE id = ?`,
      args: [JSON.stringify(parsedArticle), now, processId],
    });
  } else {
    statements.push({
      sql: `INSERT INTO article_processes (
        id, article_id, text, parse_json, translation_json, provider, model, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        processId,
        articleId,
        existing.article.text,
        JSON.stringify(parsedArticle),
        null,
        null,
        null,
        now,
        now,
      ],
    });
  }

  statements.push({
    sql: `UPDATE articles
          SET latest_process_id = ?, updated_at = ?
          WHERE id = ?`,
    args: [processId, now, articleId],
  });

  await db.batch(statements, "write");
  return getArticleDetail(articleId, db);
}

export async function saveArticleTranslation(
  articleId: string,
  input: SaveArticleTranslationInput,
  client?: Client,
): Promise<ArticleDetail | null> {
  const db = getClient(client);
  const existing = await getArticleDetail(articleId, db);

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const reusableProcess = await getReusableProcess(articleId, existing.article.text, db);
  const processId = reusableProcess?.id ?? crypto.randomUUID();
  const translation = {
    paragraphs: input.paragraphs,
    memory: input.memory,
  };
  const statements: InStatement[] = [];

  if (reusableProcess) {
    statements.push({
      sql: `UPDATE article_processes
            SET translation_json = ?, provider = ?, model = ?, updated_at = ?
            WHERE id = ?`,
      args: [JSON.stringify(translation), input.provider, input.model, now, processId],
    });
  } else {
    statements.push({
      sql: `INSERT INTO article_processes (
        id, article_id, text, parse_json, translation_json, provider, model, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        processId,
        articleId,
        existing.article.text,
        null,
        JSON.stringify(translation),
        input.provider,
        input.model,
        now,
        now,
      ],
    });
  }

  statements.push({
    sql: `UPDATE articles
          SET latest_process_id = ?, updated_at = ?
          WHERE id = ?`,
    args: [processId, now, articleId],
  });

  await db.batch(statements, "write");
  return getArticleDetail(articleId, db);
}
