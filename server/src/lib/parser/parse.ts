import { buildBunsetsu } from "./bunsetsu.ts";
import { buildChunks } from "./chunk.ts";
import { splitParagraphs, splitSentences } from "./text.ts";
import { tokenizeSentence } from "./tokenizer.ts";
import type { ParsedArticle, Sentence } from "./types.ts";

export class JapaneseParser {
  async parse(text: string): Promise<ParsedArticle> {
    const paragraphs = splitParagraphs(text).map((paragraph) => ({
      originalText: paragraph,
      sentences: splitSentences(paragraph).map((sentence) => this.parseSentence(sentence)),
    }));

    return { paragraphs };
  }

  parseSentence(sentenceText: string): Sentence {
    const tokens = tokenizeSentence(sentenceText);
    const bunsetsu = buildBunsetsu(tokens);
    const chunks = buildChunks(tokens, bunsetsu);

    return {
      originalText: sentenceText,
      tokens,
      bunsetsu,
      chunks,
      dependencies: null,
    };
  }
}

export async function parseArticle(text: string): Promise<ParsedArticle> {
  const parser = new JapaneseParser();
  return await parser.parse(text);
}
