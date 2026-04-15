import { inferChunkRole, shouldStartChunk } from "./rules.ts";
import type { Bunsetsu, Chunk, Token } from "./types.ts";

export function buildChunks(tokens: Token[], bunsetsu: Bunsetsu[]): Chunk[] {
  const merged: Chunk[] = [];

  for (const item of bunsetsu) {
    if (merged.length === 0) {
      merged.push({
        index: 0,
        text: item.text,
        tokenIndices: [...item.tokenIndices],
        bunsetsuIndices: [item.index],
        roleHint: item.roleHint,
      });
      continue;
    }

    const firstTokenIndex = item.tokenIndices[0];
    const current = tokens[firstTokenIndex];
    const previous = tokens[firstTokenIndex - 1];

    if (!shouldStartChunk(current, previous)) {
      const last = merged[merged.length - 1];
      last.text += item.text;
      last.tokenIndices.push(...item.tokenIndices);
      last.bunsetsuIndices.push(item.index);
      last.roleHint = inferChunkRole(last.tokenIndices.map((tokenIndex) => tokens[tokenIndex]));
      continue;
    }

    merged.push({
      index: merged.length,
      text: item.text,
      tokenIndices: [...item.tokenIndices],
      bunsetsuIndices: [item.index],
      roleHint: item.roleHint,
    });
  }

  return merged;
}
