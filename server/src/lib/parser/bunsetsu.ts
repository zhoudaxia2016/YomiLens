import { getBunsetsuRules, inferChunkRole, nodeText, PUNCT_POS, reduceNodes } from "./rules.ts";
import type { Bunsetsu, Node, Token } from "./types.ts";

function isOpeningPunctuationOnly(item: Bunsetsu, tokens: Token[]) {
  return item.tokenIndices.every((tokenIndex) => {
    const token = tokens[tokenIndex];
    return PUNCT_POS.has(token.pos) && token.posDetail[1] === "括弧開";
  });
}

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
  let pendingLeadingPunctuation: Bunsetsu | null = null;
  for (const item of bunsetsu) {
    const isPunctuationOnly = item.tokenIndices.every((tokenIndex) => PUNCT_POS.has(tokens[tokenIndex].pos));
    if (isPunctuationOnly && isOpeningPunctuationOnly(item, tokens)) {
      if (pendingLeadingPunctuation) {
        pendingLeadingPunctuation.text += item.text;
        pendingLeadingPunctuation.tokenIndices.push(...item.tokenIndices);
      } else {
        pendingLeadingPunctuation = {
          ...item,
          tokenIndices: [...item.tokenIndices],
        };
      }
      continue;
    }

    if (pendingLeadingPunctuation) {
      item.text = pendingLeadingPunctuation.text + item.text;
      item.tokenIndices = [...pendingLeadingPunctuation.tokenIndices, ...item.tokenIndices];
      item.roleHint = inferChunkRole(item.tokenIndices.map((tokenIndex) => tokens[tokenIndex]));
      pendingLeadingPunctuation = null;
    }

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

  if (pendingLeadingPunctuation) {
    merged.push({
      ...pendingLeadingPunctuation,
      index: merged.length,
    });
  }

  return merged;
}
