import { TokenizerBuilder } from "lindera-wasm-nodejs-ipadic";
import { normalizeToken } from "./normalize.ts";
import type { LinderaToken, Token } from "./types.ts";

let tokenizer: ReturnType<TokenizerBuilder["build"]> | null = null;

function getTokenizer() {
  if (tokenizer) return tokenizer;
  const builder = new TokenizerBuilder();
  builder.setDictionary("embedded://ipadic");
  tokenizer = builder.build();
  return tokenizer;
}

export function tokenizeSentence(sentenceText: string): Token[] {
  const rawTokens = getTokenizer().tokenize(sentenceText) as unknown as LinderaToken[];
  return rawTokens.map(normalizeToken);
}
