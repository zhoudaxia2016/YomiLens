import { getBunsetsuRules, inferChunkRole, nodeText, PUNCT_POS, reduceNodes } from "./rules.ts";
import type { Bunsetsu, Node, Token } from "./types.ts";

export function buildBunsetsu(tokens: Token[]): Bunsetsu[] {
  const baseNodes: Node[] = tokens.map((token) => ({
    label: "token",
    tokens: [token],
  }));

  const reducedNodes = reduceNodes(baseNodes, getBunsetsuRules());
  const bunsetsu = reducedNodes.map((node, index) => ({
    index,
    text: nodeText(node),
    tokenIndices: node.tokens.map((token) => token.index),
    roleHint: inferChunkRole(node.tokens),
  }));

  const merged: Bunsetsu[] = [];
  for (const item of bunsetsu) {
    const isPunctuationOnly = item.tokenIndices.every((tokenIndex) => PUNCT_POS.has(tokens[tokenIndex].pos));
    if (isPunctuationOnly && merged.length > 0) {
      const previous = merged[merged.length - 1];
      previous.text += item.text;
      previous.tokenIndices.push(...item.tokenIndices);
      continue;
    }

    merged.push({
      ...item,
      index: merged.length,
    });
  }

  return merged;
}
