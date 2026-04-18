import { getDbClient } from "./client.ts";

async function migrateNotesToTags(): Promise<void> {
  const client = getDbClient();

  try {
    const res = await client.execute({ sql: "PRAGMA table_info(articles)", args: [] });
    const names = new Set(
      res.rows.map((row) => String((row as Record<string, unknown>).name)),
    );

    if (!names.has("tags")) {
      await client.execute({
        sql: "ALTER TABLE articles ADD COLUMN tags TEXT NOT NULL DEFAULT ''",
        args: [],
      });
    }

    if (names.has("notes")) {
      await client.execute({
        sql: "UPDATE articles SET tags = notes WHERE TRIM(tags) = ''",
        args: [],
      });
    }
  } catch (error) {
    console.warn("[db] migration notes->tags failed", error);
  }
}

async function migrateTagsToJson(): Promise<void> {
  const client = getDbClient();

  try {
    const res = await client.execute({ sql: "PRAGMA table_info(articles)", args: [] });
    const names = new Set(
      res.rows.map((row) => String((row as Record<string, unknown>).name)),
    );

    if (!names.has("tags_json")) {
      await client.execute({
        sql: "ALTER TABLE articles ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'",
        args: [],
      });
    }

    const selectCols = ["id", "tags_json"];
    if (names.has("tags")) selectCols.push("tags");
    if (names.has("notes")) selectCols.push("notes");

    const rows = await client.execute({
      sql: `SELECT ${selectCols.join(", ")} FROM articles`,
      args: [],
    });

    for (const row of rows.rows) {
      const record = row as Record<string, unknown>;
      const current = String(record.tags_json ?? "[]");
      if (current.trim() !== "[]") {
        continue;
      }

      const raw = String(record.tags ?? record.notes ?? "").trim();
      const nextTags = raw ? [raw] : [];
      await client.execute({
        sql: "UPDATE articles SET tags_json = ? WHERE id = ?",
        args: [JSON.stringify(nextTags), String(record.id)],
      });
    }
  } catch (error) {
    console.warn("[db] migration tags->tags_json failed", error);
  }
}

export async function initDb(): Promise<void> {
  await Deno.mkdir(new URL("../../data/", import.meta.url), { recursive: true }).catch(() => {});

  const client = getDbClient();

  await client.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_text TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  source_locale TEXT NOT NULL DEFAULT 'ja-JP',
  status TEXT NOT NULL DEFAULT 'draft',
  latest_parse_id TEXT,
  latest_parse_version TEXT,
  paragraph_count INTEGER NOT NULL DEFAULT 0,
  sentence_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_parsed_at TEXT
)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_articles_updated_at
ON articles (updated_at DESC)`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS article_parses (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  parser_version TEXT NOT NULL,
  source_text_hash TEXT NOT NULL,
  article_json TEXT NOT NULL,
  raw_model_output TEXT NOT NULL,
  paragraph_count INTEGER NOT NULL DEFAULT 0,
  sentence_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_article_parses_article_created
ON article_parses (article_id, created_at DESC)`,
      args: [],
    },
  ], "write");

  await migrateNotesToTags();
  await migrateTagsToJson();
}
