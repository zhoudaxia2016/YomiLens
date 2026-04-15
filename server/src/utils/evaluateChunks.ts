import { JapaneseParser } from "../lib/parser/index.ts";

type BenchmarkCase = {
  id: string;
  text: string;
  expectedChunks: string[];
  notes?: string;
};

type BenchmarkResult = {
  id: string;
  ok: boolean;
  expected: string[];
  actual: string[];
  notes?: string;
};

const BENCHMARK_PATH = new URL("../../data/chunk-benchmark.json", import.meta.url);

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function formatChunkList(chunks: string[]): string {
  return chunks.map((chunk, index) => `${index + 1}. ${chunk}`).join("\n");
}

async function loadBenchmarkCases(): Promise<BenchmarkCase[]> {
  const raw = await Deno.readTextFile(BENCHMARK_PATH);
  const value = JSON.parse(raw);

  if (!Array.isArray(value)) {
    throw new Error("chunk-benchmark.json must be an array");
  }

  return value.map((item, index) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      typeof item.text !== "string" ||
      !Array.isArray(item.expectedChunks) ||
      !item.expectedChunks.every((chunk: unknown) => typeof chunk === "string")
    ) {
      throw new Error(`Invalid benchmark case at index ${index}`);
    }

    return {
      id: item.id,
      text: item.text,
      expectedChunks: item.expectedChunks,
      notes: typeof item.notes === "string" ? item.notes : undefined,
    };
  });
}

async function main() {
  const parser = new JapaneseParser();
  const benchmarkCases = await loadBenchmarkCases();

  const results: BenchmarkResult[] = benchmarkCases.map((testCase) => {
    const sentence = parser.parseSentence(testCase.text);
    const actual = sentence.chunks.map((chunk) => chunk.text);

    return {
      id: testCase.id,
      ok: arraysEqual(testCase.expectedChunks, actual),
      expected: testCase.expectedChunks,
      actual,
      notes: testCase.notes,
    };
  });

  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;

  console.log(`Chunk benchmark: ${passed}/${results.length} passed`);

  if (failed === 0) return;

  for (const result of results.filter((item) => !item.ok)) {
    console.log(`\n[FAIL] ${result.id}`);
    if (result.notes) console.log(`notes: ${result.notes}`);
    console.log("expected:");
    console.log(formatChunkList(result.expected));
    console.log("actual:");
    console.log(formatChunkList(result.actual));
  }

  Deno.exit(1);
}

if (import.meta.main) {
  await main();
}
