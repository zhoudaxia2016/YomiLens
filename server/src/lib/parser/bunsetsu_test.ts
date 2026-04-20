import { JapaneseParser } from "./index.ts";
import { splitSentences } from "./text.ts";

function assertEquals<T>(actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("buildBunsetsu attaches opening quote to the following phrase", () => {
  const parser = new JapaneseParser();
  const sentence = parser.parseSentence("「お母さん！」と叫んだ。");

  assertEquals(
    sentence.bunsetsu.map((item) => item.text),
    ["「お母さん！」", "と", "叫んだ。"],
  );

  assertEquals(
    sentence.chunks.map((item) => item.text),
    ["「お母さん！」と", "叫んだ。"],
  );
});

Deno.test("splitSentences keeps quote-final exclamation inside the same sentence", () => {
  assertEquals(
    splitSentences("ある土曜日の放課後、清一はカバンを確かりとおさへて、家ンなかへ慌しく駆け込むやいなや、其の儘帽子も脱がず、「お母さん！」と叫んだ。"),
    ["ある土曜日の放課後、清一はカバンを確かりとおさへて、家ンなかへ慌しく駆け込むやいなや、其の儘帽子も脱がず、「お母さん！」と叫んだ。"],
  );
});

Deno.test("parseSentence starts a new chunk for quoted speech", () => {
  const parser = new JapaneseParser();
  const sentence = parser.parseSentence(
    "ある土曜日の放課後、清一はカバンを確かりとおさへて、家ンなかへ慌しく駆け込むやいなや、其の儘帽子も脱がず、「お母さん！」と叫んだ。",
  );

  assertEquals(
    sentence.chunks.slice(-3).map((item) => item.text),
    ["脱がず、", "「お母さん！」と", "叫んだ。"],
  );
});
