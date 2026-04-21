import type {
  TranslationModelConfig,
  TranslateParagraphInput,
  TranslateParagraphOutput,
} from "./types.ts";

const SYSTEM_PROMPT = `你是日语翻译助手。翻译日语段落，维护上下文记忆。

翻译规则：
- 译文自然流畅，保持语气一致
- 已出现术语使用统一译法

记忆更新：
- summary: 摘要前文，100字内
- terms: 只记录需要翻译的术语（人名、地名、专有名词），不需要翻译的词不要记录

使用XML标签返回：
<translation>
<s>句子0翻译</s>
<s>句子1翻译</s>
</translation>
<summary>前文摘要</summary>
<terms>
<t jp="人名" cn="中文译名"/>
</terms>`;

type LlmResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  timings?: {
    prompt_n?: number;
    prompt_ms?: number;
    prompt_per_second?: number;
    predicted_n?: number;
    predicted_ms?: number;
    predicted_per_second?: number;
  };
  prompt_n?: number;
  prompt_ms?: number;
  prompt_per_second?: number;
  predicted_n?: number;
  predicted_ms?: number;
  predicted_per_second?: number;
};

const ANSI = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
} as const;

function parseXML(content: string, tag: string): string {
  const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function parseSentences(content: string): string[] {
  const sentences: string[] = [];
  const regex = /<s>([\s\S]*?)<\/s>/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    sentences.push(match[1].trim());
  }
  return sentences;
}

function parseTerms(content: string): Array<{ japanese: string; chinese: string }> {
  const terms: Array<{ japanese: string; chinese: string }> = [];
  const regex = /<t\s+jp="([^"]+)"\s+cn="([^"]+)"[^>]*\/>/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1] !== match[2]) {
      terms.push({
        japanese: match[1],
        chinese: match[2],
      });
    }
  }
  return terms;
}

function formatMetric(value: number | undefined, fractionDigits = 2): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(fractionDigits)
    : "n/a";
}

function colorize(color: string, text: string): string {
  return `${color}${text}${ANSI.reset}`;
}

function formatMetricField(label: string, value: string, color: string): string {
  return `${label}=${colorize(color, value)}`;
}

function getTokenMetrics(data: LlmResponse) {
  const promptTokens = data.usage?.prompt_tokens ?? data.timings?.prompt_n ?? data.prompt_n;
  const completionTokens = data.usage?.completion_tokens ?? data.timings?.predicted_n ?? data.predicted_n;
  const totalTokens = data.usage?.total_tokens ??
    (typeof promptTokens === "number" && typeof completionTokens === "number"
      ? promptTokens + completionTokens
      : undefined);
  const predictedPerSecond = data.timings?.predicted_per_second ?? data.predicted_per_second;
  const promptMs = data.timings?.prompt_ms ?? data.prompt_ms;
  const predictedMs = data.timings?.predicted_ms ?? data.predicted_ms;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    predictedPerSecond,
    promptMs,
    predictedMs,
  };
}

export async function translateParagraph(
  input: TranslateParagraphInput,
  config: TranslationModelConfig
): Promise<TranslateParagraphOutput> {
  const apiUrl = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  
  const sentencesText = input.currentParagraph.sentences
    .map((s) => s.text)
    .join("\n");
  
  let contextText = "";
  if (input.recentContext.length > 0) {
    contextText = "\n前文翻译：\n" + input.recentContext
      .map((c) => `${c.originalText}\n→ ${c.translation}`)
      .join("\n\n");
  }

  let termsText = "";
  if ("terms" in input.memory && input.memory.terms?.length > 0) {
    termsText = "\n术语表：\n" + input.memory.terms
      .map((t) => `${t.japanese} → ${t.chinese}`)
      .join("\n");
  }

  const userMessage = `翻译以下日语段落：

${sentencesText}
${contextText}
${termsText}`;

  const startTime = Date.now();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[Translate] Paragraph ${input.currentParagraphIndex}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`[User Message]\n${userMessage.substring(0, 800)}...`);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Translate] API error: ${response.status} - ${errorText}`);
    throw new Error(`${config.provider} API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as LlmResponse;
  const content = data.choices?.[0]?.message?.content;
  const metrics = getTokenMetrics(data);

  const elapsed = Date.now() - startTime;
  console.log(`\n[Response] ${elapsed}ms`);
  console.log(
    `[Metrics] ${
      [
        formatMetricField("prompt_tokens", String(metrics.promptTokens ?? "n/a"), ANSI.cyan),
        formatMetricField("completion_tokens", String(metrics.completionTokens ?? "n/a"), ANSI.cyan),
        formatMetricField("total_tokens", String(metrics.totalTokens ?? "n/a"), ANSI.cyan),
        formatMetricField("prompt_ms", formatMetric(metrics.promptMs), ANSI.yellow),
        formatMetricField("predicted_ms", formatMetric(metrics.predictedMs), ANSI.yellow),
        formatMetricField("predicted_per_second", formatMetric(metrics.predictedPerSecond), ANSI.green),
      ].join(", ")
    }`
  );

  if (!content) {
    throw new Error(`${config.provider} API returned empty response`);
  }

  console.log(`\n[Raw Output]\n${content.substring(0, 500)}...`);

  try {
    const translationBlock = parseXML(content, "translation");
    const sentenceTexts = parseSentences(translationBlock);
    
    const summary = parseXML(content, "summary");
    const termsBlock = parseXML(content, "terms");
    const terms = parseTerms(termsBlock);

    const result: TranslateParagraphOutput = {
      paragraphTranslation: sentenceTexts.join(""),
      sentences: sentenceTexts.map((text, index) => ({
        sentenceIndex: index,
        translation: text,
        tokens: [],
      })),
      memory: {
        summary,
        characters: [],
        terms,
        tone: "",
      },
      metrics: {
        promptMs: metrics.promptMs,
        predictedMs: metrics.predictedMs,
      },
    };

    console.log(`[Translate] Paragraph ${input.currentParagraphIndex}: SUCCESS`);
    console.log(`[Result] sentences=${sentenceTexts.length}, terms=${terms.length}`);
    
    return result;
  } catch (e) {
    console.error(`[Translate] Parse error: ${e}`);
    console.error(`[Translate] Full content:\n${content}`);
    throw new Error(`Failed to parse ${config.provider} response: ${e}`);
  }
}
