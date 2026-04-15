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
  const matches = paragraph.match(/[^。！？!?]+[。！？!?]?/g) ?? [];
  return matches.map((sentence) => sentence.trim()).filter(Boolean);
}
