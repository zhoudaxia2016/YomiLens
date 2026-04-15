import type { ChunkRole, Node, PatternPart, SequenceRule, Token } from "./types.ts";

export const PUNCT_POS = new Set(["記号"]);
const PREDICATE_POS = new Set(["動詞", "形容詞", "形容動詞"]);
const NOUNISH_POS = new Set(["名詞", "代名詞", "接尾辞"]);
const PARTICLE_LIKE_POS = new Set(["助詞", "助動詞", "接尾辞"]);
const MODIFIER_SUFFIXES = [
  "について",
  "に対して",
  "とともに",
  "と共に",
  "として",
  "とは",
  "とも",
  "には",
  "にも",
  "での",
  "への",
  "との",
  "から",
  "まで",
  "より",
  "にて",
  "ので",
  "の",
  "に",
  "で",
  "へ",
  "と",
] as const;
const JPHRASE_BOUNDARY_BASE_POS = new Set([
  "名詞",
  "動詞",
  "副詞",
  "感動詞",
  "形容詞",
  "形容動詞",
  "連体詞",
  "接頭詞",
]);

export function nodeText(node: Node): string {
  return node.tokens.map((token) => token.surface).join("");
}

function isSingleTokenNode(node: Node): boolean {
  return node.tokens.length === 1;
}

function isPunctuationNode(node: Node): boolean {
  return node.tokens.length === 1 && PUNCT_POS.has(node.tokens[0].pos);
}

function isParticleLikeNode(node: Node): boolean {
  return node.tokens.every((token) => PARTICLE_LIKE_POS.has(token.pos));
}

function isNominalBaseNode(node: Node): boolean {
  return node.label === "noun_phrase" || node.tokens.every((token) => NOUNISH_POS.has(token.pos));
}

function isAdverbialBaseNode(node: Node): boolean {
  const first = node.tokens[0];
  return node.label === "modifier" || (!!first && first.pos === "副詞");
}

function isSahenBaseNode(node: Node): boolean {
  const last = node.tokens.at(-1);
  if (!last) return false;
  return isNominalBaseNode(node) && last.posDetail[1] === "サ変接続";
}

function isPredicateNode(node: Node): boolean {
  if (node.label === "predicate") return true;
  const last = node.tokens.at(-1);
  if (!last) return false;
  return PREDICATE_POS.has(last.pos);
}

function isSuruFamilyToken(token: Token): boolean {
  return token.pos === "動詞" && (token.lemma === "する" || ["し", "する", "さ", "せ"].includes(token.surface));
}

function isAuxiliaryPredicateToken(token: Token): boolean {
  if (token.pos === "助動詞") return true;
  if (token.pos === "動詞" && token.posDetail[1] === "非自立") return true;
  if (token.pos === "動詞" && token.posDetail[1] === "接尾") return true;
  if (token.pos === "助詞" && (token.surface === "て" || token.surface === "で")) return true;
  return false;
}

function startsWithAuxiliaryPredicate(node: Node): boolean {
  const first = node.tokens[0];
  return first ? isAuxiliaryPredicateToken(first) : false;
}

function isNounLikeToken(token: Token): boolean {
  return NOUNISH_POS.has(token.pos) || token.pos === "接頭辞" || token.pos === "連体詞";
}

function isQuotingToToken(token: Token): boolean {
  return token.surface === "と" && token.pos === "助詞" && token.posDetail[2] === "引用";
}

export function inferChunkRole(tokens: Token[]): ChunkRole {
  const significantTokens = tokens.filter((token) => !PUNCT_POS.has(token.pos));
  if (significantTokens.length === 0) return "other";

  const text = significantTokens.map((token) => token.surface).join("");
  const last = significantTokens[significantTokens.length - 1];
  const previous = significantTokens[significantTokens.length - 2];
  const hasPredicateCore = significantTokens.some((token) => PREDICATE_POS.has(token.pos));

  if (
    hasPredicateCore ||
    (last.pos === "助動詞" && ["だ", "です", "だった", "た", "ない", "ます"].includes(last.surface))
  ) {
    return "predicate";
  }

  if (MODIFIER_SUFFIXES.some((suffix) => text.endsWith(suffix))) return "modifier";
  if (text.endsWith("は")) return "topic";
  if (text.endsWith("も") && previous?.surface !== "と") return "topic";
  if (text.endsWith("が")) return "subject";
  if (text.endsWith("を")) return "object";
  if (last.pos === "副詞" || last.pos === "連体詞") {
    return "modifier";
  }
  if (last.pos === "名詞" && last.posDetail[1] === "副詞可能") {
    return "modifier";
  }
  return "other";
}

function matchValue<T extends string>(actual: T | null | undefined, expected: T | T[]): boolean {
  if (actual == null) return false;
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

function matchCategory(node: Node, category: NonNullable<PatternPart["category"]>): boolean {
  switch (category) {
    case "nominal":
      return isNominalBaseNode(node);
    case "predicate":
      return isPredicateNode(node);
    case "modifier":
      return isAdverbialBaseNode(node);
    case "particleLike":
      return isParticleLikeNode(node) && !isPunctuationNode(node);
    case "punctuation":
      return isPunctuationNode(node);
  }
}

function matchPatternPart(node: Node, part: PatternPart): boolean {
  if (part.singleTokenOnly && !isSingleTokenNode(node)) return false;
  if (part.label && !matchValue(node.label, part.label)) return false;
  if (part.category && !matchCategory(node, part.category)) return false;

  const first = node.tokens[0];
  if (part.pos && (!first || !matchValue(first.pos, part.pos))) return false;
  if (part.pos1 && (!first || !matchValue(first.posDetail[1] ?? "", part.pos1))) return false;
  if (part.pos2 && (!first || !matchValue(first.posDetail[2] ?? "", part.pos2))) return false;
  if (part.surface && (!first || !matchValue(first.surface, part.surface))) return false;
  if (part.lemma && (!first || !matchValue(first.lemma, part.lemma))) return false;
  if (part.custom && !part.custom(node)) return false;

  return true;
}

function matchPattern(nodes: Node[], index: number, pattern: PatternPart[]): number | null {
  if (index + pattern.length > nodes.length) return null;

  for (let offset = 0; offset < pattern.length; offset += 1) {
    if (!matchPatternPart(nodes[index + offset], pattern[offset])) return null;
  }

  return pattern.length;
}

function mergeNodes(label: Node["label"], nodes: Node[], index: number, length: number): Node {
  return {
    label,
    tokens: nodes.slice(index, index + length).flatMap((node) => node.tokens),
  };
}

export function reduceNodes(initialNodes: Node[], rules: SequenceRule[]): Node[] {
  let nodes = initialNodes.slice();
  const orderedRules = [...rules].sort((left, right) => right.priority - left.priority);
  let changed = true;

  while (changed) {
    changed = false;

    for (const rule of orderedRules) {
      for (let index = 0; index < nodes.length; index += 1) {
        const length = matchPattern(nodes, index, rule.pattern);
        if (!length) continue;

        const resultLabel = rule.resultLabelResolver?.(nodes, index, length) ?? rule.resultLabel;
        nodes = [
          ...nodes.slice(0, index),
          mergeNodes(resultLabel, nodes, index, length),
          ...nodes.slice(index + length),
        ];
        changed = true;
        break;
      }
      if (changed) break;
    }
  }

  return nodes;
}

export function getBunsetsuRules(): SequenceRule[] {
  return [
    {
      name: "merge-noun-sequence",
      priority: 110,
      pattern: [
        { singleTokenOnly: true, custom: (node) => isNounLikeToken(node.tokens[0]) },
        { singleTokenOnly: true, custom: (node) => isNounLikeToken(node.tokens[0]) },
      ],
      resultLabel: "noun_phrase",
    },
    {
      name: "merge-adnominal-aux",
      priority: 105,
      pattern: [
        { singleTokenOnly: true, pos: "連体詞" },
        { singleTokenOnly: true, surface: "る" },
      ],
      resultLabel: "modifier",
    },
    {
      name: "merge-sahen-suru",
      priority: 100,
      pattern: [
        { category: "nominal", custom: isSahenBaseNode },
        { singleTokenOnly: true, custom: (node) => isSuruFamilyToken(node.tokens[0]) },
      ],
      resultLabel: "predicate",
    },
    {
      name: "merge-predicate-quote",
      priority: 87,
      pattern: [
        { category: "predicate" },
        { singleTokenOnly: true, custom: (node) => isQuotingToToken(node.tokens[0]) },
      ],
      resultLabel: "predicate",
    },
    {
      name: "merge-predicate-tail",
      priority: 90,
      pattern: [
        { category: "predicate" },
        { singleTokenOnly: true, custom: (node) => isAuxiliaryPredicateToken(node.tokens[0]) },
      ],
      resultLabel: "predicate",
    },
    {
      name: "merge-predicate-chain",
      priority: 88,
      pattern: [
        { category: "predicate" },
        { category: "predicate", custom: startsWithAuxiliaryPredicate },
      ],
      resultLabel: "predicate",
    },
    {
      name: "merge-nominal-predicate",
      priority: 85,
      pattern: [
        { category: "nominal" },
        { singleTokenOnly: true, pos: "助動詞", surface: ["だ", "です", "だった"] },
      ],
      resultLabel: "predicate",
    },
    {
      name: "merge-adverb-particle",
      priority: 75,
      pattern: [
        { category: "modifier" },
        { singleTokenOnly: true, surface: ["に", "は", "も"] },
      ],
      resultLabel: "modifier",
    },
    {
      name: "merge-noun-particle",
      priority: 70,
      pattern: [
        { category: "nominal" },
        { category: "particleLike" },
      ],
      resultLabel: "noun_phrase",
      resultLabelResolver(nodes, index) {
        const text = nodeText(nodes[index]!) + nodeText(nodes[index + 1]!);
        return text.endsWith("に") || text.endsWith("で") || text.endsWith("へ") || text.endsWith("から")
          ? "modifier"
          : "noun_phrase";
      },
    },
    {
      name: "merge-noun-no",
      priority: 68,
      pattern: [
        { category: "nominal" },
        { singleTokenOnly: true, surface: "の" },
      ],
      resultLabel: "modifier",
    },
    {
      name: "attach-formal-noun",
      priority: 60,
      pattern: [
        { category: "predicate" },
        { singleTokenOnly: true, pos: "名詞", pos1: "非自立" },
      ],
      resultLabel: "predicate",
    },
    {
      name: "merge-predicate-hodo-no",
      priority: 58,
      pattern: [
        { category: "predicate" },
        { singleTokenOnly: true, surface: "程" },
        { singleTokenOnly: true, surface: "の" },
      ],
      resultLabel: "modifier",
    },
  ];
}

export function shouldStartChunk(current: Token, previous: Token | undefined): boolean {
  const rawPos = current.posDetail[0] ?? "";
  const rawPos1 = current.posDetail[1] ?? "";
  const previousRawPos = previous?.posDetail[0] ?? "";
  const previousRawPos1 = previous?.posDetail[1] ?? "";

  if (!JPHRASE_BOUNDARY_BASE_POS.has(rawPos)) return false;
  if (rawPos === "名詞" && rawPos1.includes("接尾")) return false;
  if (previousRawPos === "接頭詞") return false;
  if (rawPos === "名詞" && rawPos1.includes("非自立")) return false;
  if (rawPos === "動詞" && rawPos1.includes("非自立")) return false;
  if (
    rawPos === "動詞" &&
    current.lemma === "する" &&
    previousRawPos1.includes("サ変接続")
  ) {
    return false;
  }

  return true;
}
