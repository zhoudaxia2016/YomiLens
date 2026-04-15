import type {
  Conjugation,
  ConjugationForm,
  ConjugationType,
  LinderaToken,
  Pos,
  Token,
} from "./types.ts";
import { POS_VALUES } from "./types.ts";

const READING_OVERRIDES: Record<string, string> = {
  "就て": "ついて",
  "就": "ついて",
  "或る": "ある",
};

function mapPos(partOfSpeech: string, subcategory1: string): Pos {
  if (partOfSpeech === "名詞" && subcategory1 === "代名詞") return "代名詞";
  if (partOfSpeech === "名詞" && subcategory1 === "形容動詞語幹") return "形容動詞";
  if (partOfSpeech === "名詞" && subcategory1 === "接尾") return "接尾辞";
  if (partOfSpeech === "接頭詞") return "接頭辞";
  if (POS_VALUES.includes(partOfSpeech as Pos)) return partOfSpeech as Pos;
  return "名詞";
}

function mapConjugationType(value: string | undefined): ConjugationType | undefined {
  if (!value || value === "*") return undefined;
  if (value.startsWith("五段")) return "五段";
  if (value.startsWith("一段")) return "一段";
  if (value.startsWith("カ変")) return "カ変";
  if (value.startsWith("サ変")) return "サ変";
  if (value.startsWith("形容詞")) return "形容詞";
  if (value.startsWith("形容動詞")) return "形容動詞";
  return undefined;
}

function mapConjugationForm(value: string | undefined): ConjugationForm | undefined {
  if (!value || value === "*") return undefined;
  if (value.startsWith("未然")) return "未然形A";
  if (value.startsWith("連用")) return "連用形A";
  if (value.startsWith("基本形") || value.startsWith("終止")) return "終止形";
  if (value.startsWith("連体")) return "連体形";
  if (value.startsWith("仮定")) return "仮定形";
  if (value.startsWith("命令")) return "命令形";
  return undefined;
}

function extractConjugation(token: LinderaToken): Conjugation | undefined {
  const type = mapConjugationType(token.conjugationType);
  const form = mapConjugationForm(token.conjugationForm);
  if (!type || !form) return undefined;
  return { type, form };
}

function toHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function resolveReading(raw: LinderaToken): string {
  if (READING_OVERRIDES[raw.surface]) return READING_OVERRIDES[raw.surface];
  if (raw.reading && raw.reading !== "*") return toHiragana(raw.reading);
  if (raw.baseForm && READING_OVERRIDES[raw.baseForm]) return READING_OVERRIDES[raw.baseForm];
  return "";
}

function generateFurigana(surface: string, reading: string): string {
  return /[\u4e00-\u9faf]/.test(surface) ? reading : "";
}

export function normalizeToken(raw: LinderaToken, index: number): Token {
  const reading = resolveReading(raw);
  return {
    index,
    surface: raw.surface,
    lemma: raw.baseForm === "*" ? raw.surface : raw.baseForm,
    reading,
    furigana: generateFurigana(raw.surface, reading),
    pos: mapPos(raw.partOfSpeech, raw.partOfSpeechSubcategory1),
    posDetail: [
      raw.partOfSpeech,
      raw.partOfSpeechSubcategory1,
      raw.partOfSpeechSubcategory2,
      raw.partOfSpeechSubcategory3,
    ],
    byteStart: raw.byteStart,
    byteEnd: raw.byteEnd,
    conjugation: extractConjugation(raw),
  };
}
