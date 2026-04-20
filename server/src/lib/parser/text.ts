export function splitParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const blankLineParagraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (blankLineParagraphs.length > 1) {
    return blankLineParagraphs;
  }

  return normalized
    .split("\n")
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function splitSentences(paragraph: string): string[] {
  const normalized = paragraph.trim();
  if (!normalized) {
    return [];
  }

  const openingMarks = new Set(["「", "『", "（", "(", "［", "【", "〈", "《", "〔"]);
  const closingMarks = new Set(["」", "』", "）", ")", "］", "】", "〉", "》", "〕"]);
  const sentenceTerminators = new Set(["。", "！", "？", "!", "?"]);
  const sentences: string[] = [];

  let current = "";
  let nestedDepth = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    current += char;

    if (openingMarks.has(char)) {
      nestedDepth += 1;
      continue;
    }

    if (closingMarks.has(char)) {
      nestedDepth = Math.max(0, nestedDepth - 1);
      continue;
    }

    if (!sentenceTerminators.has(char) || nestedDepth > 0) {
      continue;
    }

    let lookahead = index + 1;
    while (lookahead < normalized.length && closingMarks.has(normalized[lookahead])) {
      current += normalized[lookahead];
      nestedDepth = Math.max(0, nestedDepth - 1);
      index = lookahead;
      lookahead += 1;
    }

    sentences.push(current.trim());
    current = "";
  }

  if (current.trim()) {
    sentences.push(current.trim());
  }

  return sentences;
}
