import type { Client, InStatement } from "@libsql/client";
import type { ParsedArticle } from "../lib/parser/index.ts";
import { getDbClient } from "./client.ts";

export const PARSER_VERSION = "article-parse-v1";

export type ArticleStatus = "draft" | "parsed";

export type ArticleRecord = {
  id: string;
  title: string;
  sourceText: string;
  tags: string[];
  sourceLocale: "ja-JP";
  status: ArticleStatus;
  latestParseId: string | null;
  latestParseVersion: string | null;
  paragraphCount: number;
  sentenceCount: number;
  tokenCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  lastParsedAt: string | null;
};

export type ArticleParseRecord = {
  id: string;
  articleId: string;
  parserVersion: string;
  sourceTextHash: string;
  article: ParsedArticle;
  rawModelOutput: string;
  paragraphCount: number;
  sentenceCount: number;
  tokenCount: number;
  chunkCount: number;
  createdAt: string;
};

export type ArticleListItem = {
  id: string;
  title: string;
};

export type ArticleDetail = {
  article: ArticleRecord;
  latestParse: ArticleParseRecord | null;
};

type ArticleStats = Pick<
  ArticleRecord,
  "paragraphCount" | "sentenceCount" | "tokenCount" | "chunkCount"
>;

export type UpsertArticleInput = {
  title: string;
  sourceText: string;
  tags: string[];
};

function rowToArticle(row: Record<string, unknown>): ArticleRecord {
  const tagsJson = String(row.tags_json ?? "[]");
  const fallbackTag = String(row.tags ?? row.notes ?? "").trim();

  return {
    id: String(row.id),
    title: String(row.title),
    sourceText: String(row.source_text),
    tags: parseTags(tagsJson, fallbackTag),
    sourceLocale: "ja-JP",
    status: String(row.status) === "parsed" ? "parsed" : "draft",
    latestParseId: row.latest_parse_id ? String(row.latest_parse_id) : null,
    latestParseVersion: row.latest_parse_version ? String(row.latest_parse_version) : null,
    paragraphCount: Number(row.paragraph_count ?? 0),
    sentenceCount: Number(row.sentence_count ?? 0),
    tokenCount: Number(row.token_count ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastParsedAt: row.last_parsed_at ? String(row.last_parsed_at) : null,
  };
}

function rowToParse(row: Record<string, unknown>): ArticleParseRecord {
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    parserVersion: String(row.parser_version),
    sourceTextHash: String(row.source_text_hash),
    article: JSON.parse(String(row.article_json)) as ParsedArticle,
    rawModelOutput: String(row.raw_model_output),
    paragraphCount: Number(row.paragraph_count ?? 0),
    sentenceCount: Number(row.sentence_count ?? 0),
    tokenCount: Number(row.token_count ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    createdAt: String(row.created_at),
  };
}

function getClient(client?: Client) {
  return client ?? getDbClient();
}

export async function listArticles(client?: Client): Promise<ArticleListItem[]> {
  const db = getClient(client);
  const res = await db.execute(`SELECT * FROM articles ORDER BY updated_at DESC`);

  return res.rows.map((row) => {
    const article = rowToArticle(row as Record<string, unknown>);
    return {
      id: article.id,
      title: article.title,
    };
  });
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
  let latestParse: ArticleParseRecord | null = null;

  if (article.latestParseId) {
    const parseRes = await db.execute({
      sql: `SELECT * FROM article_parses WHERE id = ? AND article_id = ?`,
      args: [article.latestParseId, articleId],
    });

    if (parseRes.rows.length > 0) {
      latestParse = rowToParse(parseRes.rows[0] as Record<string, unknown>);
    }
  }

  return { article, latestParse };
}

export async function createArticle(
  input: UpsertArticleInput,
  client?: Client,
): Promise<ArticleDetail> {
  const db = getClient(client);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO articles (
      id, title, source_text, tags, tags_json, source_locale, status,
      latest_parse_id, latest_parse_version,
      paragraph_count, sentence_count, token_count, chunk_count,
      created_at, updated_at, last_parsed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.title,
      input.sourceText,
      input.tags.join(", "),
      JSON.stringify(normalizeTags(input.tags)),
      "ja-JP",
      "draft",
      null,
      null,
      0,
      0,
      0,
      0,
      now,
      now,
      null,
    ],
  });

  return {
    article: {
      id,
      title: input.title,
      sourceText: input.sourceText,
      tags: normalizeTags(input.tags),
      sourceLocale: "ja-JP",
      status: "draft",
      latestParseId: null,
      latestParseVersion: null,
      paragraphCount: 0,
      sentenceCount: 0,
      tokenCount: 0,
      chunkCount: 0,
      createdAt: now,
      updatedAt: now,
      lastParsedAt: null,
    },
    latestParse: null,
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
  const sourceChanged = existing.article.sourceText !== input.sourceText;
  await db.execute({
    sql: `UPDATE articles
          SET title = ?, source_text = ?, tags = ?, tags_json = ?, updated_at = ?,
              status = ?, latest_parse_id = ?, latest_parse_version = ?,
              paragraph_count = ?, sentence_count = ?, token_count = ?, chunk_count = ?,
              last_parsed_at = ?
          WHERE id = ?`,
    args: [
      input.title,
      input.sourceText,
      input.tags.join(", "),
      JSON.stringify(normalizeTags(input.tags)),
      now,
      sourceChanged ? "draft" : existing.article.status,
      sourceChanged ? null : existing.article.latestParseId,
      sourceChanged ? null : existing.article.latestParseVersion,
      sourceChanged ? 0 : existing.article.paragraphCount,
      sourceChanged ? 0 : existing.article.sentenceCount,
      sourceChanged ? 0 : existing.article.tokenCount,
      sourceChanged ? 0 : existing.article.chunkCount,
      sourceChanged ? null : existing.article.lastParsedAt,
      articleId,
    ],
  });

  return getArticleDetail(articleId, db);
}

export async function saveArticleParse(
  articleId: string,
  parsedArticle: ParsedArticle,
  rawModelOutput: string,
  client?: Client,
): Promise<ArticleDetail | null> {
  const db = getClient(client);
  const existing = await getArticleDetail(articleId, db);

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const parseId = crypto.randomUUID();
  const stats = summarizeArticle(parsedArticle);
  const sourceTextHash = await hashText(existing.article.sourceText);
  const statements: InStatement[] = [
    {
      sql: `INSERT INTO article_parses (
        id, article_id, parser_version, source_text_hash, article_json, raw_model_output,
        paragraph_count, sentence_count, token_count, chunk_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        parseId,
        articleId,
        PARSER_VERSION,
        sourceTextHash,
        JSON.stringify(parsedArticle),
        rawModelOutput,
        stats.paragraphCount,
        stats.sentenceCount,
        stats.tokenCount,
        stats.chunkCount,
        now,
      ],
    },
    {
      sql: `UPDATE articles
            SET status = ?, latest_parse_id = ?, latest_parse_version = ?,
                paragraph_count = ?, sentence_count = ?, token_count = ?, chunk_count = ?,
                updated_at = ?, last_parsed_at = ?
            WHERE id = ?`,
      args: [
        "parsed",
        parseId,
        PARSER_VERSION,
        stats.paragraphCount,
        stats.sentenceCount,
        stats.tokenCount,
        stats.chunkCount,
        now,
        now,
        articleId,
      ],
    },
  ];

  await db.batch(statements, "write");
  return getArticleDetail(articleId, db);
}

export function summarizeArticle(article: ParsedArticle): ArticleStats {
  return {
    paragraphCount: article.paragraphs.length,
    sentenceCount: article.paragraphs.reduce((sum, paragraph) => sum + paragraph.sentences.length, 0),
    tokenCount: article.paragraphs.reduce(
      (sum, paragraph) =>
        sum + paragraph.sentences.reduce((inner, sentence) => inner + sentence.tokens.length, 0),
      0,
    ),
    chunkCount: article.paragraphs.reduce(
      (sum, paragraph) =>
        sum + paragraph.sentences.reduce((inner, sentence) => inner + sentence.chunks.length, 0),
      0,
    ),
  };
}

async function hashText(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseTags(tagsJson: string, fallbackTag: string) {
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeTags(parsed);
    }
  } catch {
    // ignore malformed legacy data and fall back to the plain-text column.
  }

  return fallbackTag ? [fallbackTag] : [];
}

function normalizeTags(tags: unknown[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => String(tag).trim())
        .filter(Boolean),
    ),
  );
}
