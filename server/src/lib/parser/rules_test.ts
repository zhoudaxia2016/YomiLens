import { inferChunkRole } from "./rules.ts";
import type { Pos, Token } from "./types.ts";

function assertEquals<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function createToken(
  surface: string,
  pos: Pos,
  pos1 = "*",
  pos2 = "*",
  pos3 = "*",
  index = 0,
): Token {
  return {
    index,
    surface,
    lemma: surface,
    reading: surface,
    furigana: surface,
    pos,
    posDetail: [pos, pos1, pos2, pos3],
    byteStart: index,
    byteEnd: index + surface.length,
  };
}

Deno.test("inferChunkRole handles modifier-like chunks that previously fell back to other", () => {
  assertEquals(inferChunkRole([createToken("最近", "名詞", "副詞可能")]), "modifier");
  assertEquals(inferChunkRole([createToken("昆虫学", "名詞"), createToken("の", "助詞")]), "modifier");
  assertEquals(
    inferChunkRole([createToken("泰斗", "名詞"), createToken("として", "助詞")]),
    "modifier",
  );
  assertEquals(inferChunkRole([createToken("呆然", "名詞"), createToken("と", "助詞")]), "modifier");
  assertEquals(
    inferChunkRole([createToken("反省", "名詞"), createToken("と", "助詞"), createToken("も", "助詞")]),
    "modifier",
  );
});

Deno.test("inferChunkRole ignores trailing punctuation when classifying", () => {
  assertEquals(
    inferChunkRole([createToken("報道", "名詞"), createToken("は", "助詞"), createToken("、", "記号")]),
    "topic",
  );
  assertEquals(
    inferChunkRole([createToken("博士", "名詞"), createToken("が", "助詞"), createToken("。", "記号")]),
    "subject",
  );
});
