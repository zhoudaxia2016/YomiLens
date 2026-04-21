import { getDbClient } from "./client.ts";

function hasTable(names: Set<string>, tableName: string) {
  return names.has(tableName);
}

async function listTables() {
  const client = getDbClient();
  const res = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table'",
    args: [],
  });

  return new Set(res.rows.map((row) => String((row as Record<string, unknown>).name)));
}

async function listColumns(tableName: string) {
  const client = getDbClient();
  const res = await client.execute({
    sql: `PRAGMA table_info(${tableName})`,
    args: [],
  });

  return new Set(res.rows.map((row) => String((row as Record<string, unknown>).name)));
}

async function getTableSql(tableName: string): Promise<string | null> {
  const client = getDbClient();
  const res = await client.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [tableName],
  });

  if (res.rows.length === 0) {
    return null;
  }

  const sql = (res.rows[0] as Record<string, unknown>).sql;
  return typeof sql === "string" ? sql : null;
}

async function createLatestSchema(): Promise<void> {
  const client = getDbClient();

  await client.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  latest_process_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_articles_updated_at
ON articles (updated_at DESC)`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS article_processes (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  parse_json TEXT,
  translation_json TEXT,
  provider TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_article_processes_article_updated
ON article_processes (article_id, updated_at DESC)`,
      args: [],
    },
  ], "write");
}

async function repairArticleProcessesForeignKey(): Promise<void> {
  const client = getDbClient();
  const tableSql = await getTableSql("article_processes");

  if (!tableSql || !tableSql.includes('REFERENCES "articles_legacy"(id)')) {
    return;
  }

  await client.batch([
    {
      sql: "PRAGMA foreign_keys = OFF",
      args: [],
    },
    {
      sql: "ALTER TABLE article_processes RENAME TO article_processes_legacy_fk",
      args: [],
    },
    {
      sql: "DROP INDEX IF EXISTS idx_article_processes_article_updated",
      args: [],
    },
    {
      sql: `CREATE TABLE article_processes (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  parse_json TEXT,
  translation_json TEXT,
  provider TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_article_processes_article_updated
ON article_processes (article_id, updated_at DESC)`,
      args: [],
    },
    {
      sql: `INSERT INTO article_processes (
  id, article_id, text, parse_json, translation_json, provider, model, created_at, updated_at
)
SELECT
  id, article_id, text, parse_json, translation_json, provider, model, created_at, updated_at
FROM article_processes_legacy_fk`,
      args: [],
    },
    {
      sql: "DROP TABLE article_processes_legacy_fk",
      args: [],
    },
    {
      sql: "PRAGMA foreign_keys = ON",
      args: [],
    },
  ], "write");
}

async function migrateToProcessSchema(): Promise<void> {
  const client = getDbClient();
  const tables = await listTables();

  if (!hasTable(tables, "articles")) {
    return;
  }

  const articleColumns = await listColumns("articles");
  const articleHasLatestProcess = articleColumns.has("latest_process_id");
  const articleHasText = articleColumns.has("text");
  const processTableExists = hasTable(tables, "article_processes");

  if (articleHasLatestProcess && articleHasText && processTableExists) {
    return;
  }

  const legacyHasSourceText = articleColumns.has("source_text");
  const legacyHasTagsJson = articleColumns.has("tags_json");
  const legacyHasCreatedAt = articleColumns.has("created_at");
  const legacyHasUpdatedAt = articleColumns.has("updated_at");
  const legacyHasLatestParseId = articleColumns.has("latest_parse_id");
  const legacyParseTableExists = hasTable(tables, "article_parses");

  await client.batch([
    {
      sql: "PRAGMA foreign_keys = OFF",
      args: [],
    },
    {
      sql: `ALTER TABLE articles RENAME TO articles_legacy`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  latest_process_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_articles_updated_at
ON articles (updated_at DESC)`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS article_processes (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  parse_json TEXT,
  translation_json TEXT,
  provider TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_article_processes_article_updated
ON article_processes (article_id, updated_at DESC)`,
      args: [],
    },
  ], "write");

  const articleRows = await client.execute({
    sql: `SELECT * FROM articles_legacy`,
    args: [],
  });

  for (const row of articleRows.rows) {
    const record = row as Record<string, unknown>;
    const articleId = String(record.id);
    const title = String(record.title ?? "未命名文章");
    const text = String(
      legacyHasSourceText ? record.source_text ?? "" : record.text ?? "",
    );
    const tagsJson = legacyHasTagsJson ? String(record.tags_json ?? "[]") : "[]";
    const createdAt = String(
      (legacyHasCreatedAt ? record.created_at : null) ?? new Date().toISOString(),
    );
    const updatedAt = String(
      (legacyHasUpdatedAt ? record.updated_at : null) ?? createdAt,
    );

    let latestProcessId: string | null = null;

    if (legacyHasLatestParseId && legacyParseTableExists && record.latest_parse_id) {
      const latestParseId = String(record.latest_parse_id);
      const parseRes = await client.execute({
        sql: "SELECT * FROM article_parses WHERE id = ?",
        args: [latestParseId],
      });

      if (parseRes.rows.length > 0) {
        const parseRecord = parseRes.rows[0] as Record<string, unknown>;
        latestProcessId = crypto.randomUUID();
        const processCreatedAt = String(parseRecord.created_at ?? updatedAt);

        await client.execute({
          sql: `INSERT INTO article_processes (
            id, article_id, text, parse_json, translation_json, provider, model, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            latestProcessId,
            articleId,
            text,
            String(parseRecord.article_json),
            null,
            null,
            null,
            processCreatedAt,
            processCreatedAt,
          ],
        });
      }
    }

    await client.execute({
      sql: `INSERT INTO articles (
        id, title, text, tags_json, latest_process_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [articleId, title, text, tagsJson, latestProcessId, createdAt, updatedAt],
    });
  }

  const cleanupStatements = [
    {
      sql: "DROP TABLE articles_legacy",
      args: [],
    },
  ];

  if (legacyParseTableExists) {
    cleanupStatements.push({
      sql: "DROP TABLE article_parses",
      args: [],
    });
  }

  cleanupStatements.push({
    sql: "PRAGMA foreign_keys = ON",
    args: [],
  });

  await client.batch(cleanupStatements, "write");
}

function normalizeStoredTranslationJson(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as {
      paragraphs?: Array<{ sentences?: unknown[] }>
      memory?: unknown
    };

    if (!Array.isArray(parsed.paragraphs)) {
      return null;
    }

    let changed = false;
    const paragraphs = parsed.paragraphs.map((paragraph) => {
      const sentenceValues = Array.isArray(paragraph?.sentences) ? paragraph.sentences : [];
      const normalizedSentences = sentenceValues
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          if (item && typeof item === "object" && "translation" in item) {
            changed = true;
            const translation = (item as { translation?: unknown }).translation;
            return typeof translation === "string" ? translation : "";
          }

          changed = true;
          return "";
        })
        .filter(Boolean);

      if (normalizedSentences.length !== sentenceValues.length) {
        changed = true;
      }

      return {
        sentences: normalizedSentences,
      };
    });

    const normalized = {
      paragraphs,
      memory: parsed.memory && typeof parsed.memory === "object" ? parsed.memory : {},
    };

    const nextRaw = JSON.stringify(normalized);
    return changed || nextRaw !== raw ? nextRaw : null;
  } catch {
    return null;
  }
}

async function migrateStoredTranslationShape(): Promise<void> {
  const client = getDbClient();
  const res = await client.execute({
    sql: `SELECT id, translation_json FROM article_processes WHERE translation_json IS NOT NULL`,
    args: [],
  });

  for (const row of res.rows) {
    const record = row as Record<string, unknown>;
    const id = String(record.id);
    const translationJson = String(record.translation_json ?? "");
    const nextJson = normalizeStoredTranslationJson(translationJson);

    if (!nextJson) {
      continue;
    }

    await client.execute({
      sql: `UPDATE article_processes SET translation_json = ? WHERE id = ?`,
      args: [nextJson, id],
    });
  }
}

export async function initDb(): Promise<void> {
  await Deno.mkdir(new URL("../../data/", import.meta.url), { recursive: true }).catch(() => {});
  await createLatestSchema();
  await migrateToProcessSchema();
  await repairArticleProcessesForeignKey();
  await migrateStoredTranslationShape();
  await createLatestSchema();
}
