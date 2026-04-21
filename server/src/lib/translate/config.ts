import type {
  TranslateConfigResponse,
  TranslationModelConfig,
  TranslationModelProvider,
} from "./types.ts";

type ProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
};

function getProviderConfig(provider: TranslationModelProvider): ProviderConfig {
  switch (provider) {
    case "deepseek":
      return {
        apiKey: Deno.env.get("DEEPSEEK_API_KEY"),
        baseUrl: Deno.env.get("DEEPSEEK_BASE_URL"),
      };
    case "llama":
      return {
        apiKey: Deno.env.get("LLAMA_API_KEY"),
        baseUrl: Deno.env.get("LLAMA_BASE_URL"),
      };
  }
}

export function loadTranslationConfigs(): TranslationModelConfig[] {
  const raw = Deno.env.get("TRANSLATION_CONFIGS_JSON");

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        configs?: Array<{
          label?: string;
          provider?: string;
          baseUrl?: string;
          model?: string;
          apiKey?: string;
        }>;
      };

      const configs = (parsed.configs ?? [])
        .map((item): TranslationModelConfig | null => {
          const provider = (item.provider === "llama" ? "llama" : "deepseek") as TranslationModelProvider;
          const providerConfig = getProviderConfig(provider);
          const baseUrl = item.baseUrl?.trim() || providerConfig.baseUrl;
          if (!baseUrl) {
            return null;
          }

          return {
            label: item.label?.trim() || provider,
            provider,
            baseUrl,
            model: item.model?.trim() || "",
            apiKey: item.apiKey?.trim() || providerConfig.apiKey,
          };
        })
        .filter((item): item is TranslationModelConfig => item !== null);

      if (configs.length > 0) {
        return configs;
      }
    } catch (error) {
      console.error(`[Translate Config] Failed to parse TRANSLATION_CONFIGS_JSON: ${error}`);
    }
  }

  const configs: TranslationModelConfig[] = [];

  const llamaBaseUrl = Deno.env.get("LLAMA_BASE_URL");
  if (llamaBaseUrl) {
    configs.push({
      label: "本地 Llama",
      provider: "llama",
      baseUrl: llamaBaseUrl,
      model: "",
      apiKey: Deno.env.get("LLAMA_API_KEY"),
    });
  }

  const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
  const deepseekBaseUrl = Deno.env.get("DEEPSEEK_BASE_URL");
  if (deepseekApiKey) {
    configs.push({
      label: "DeepSeek",
      provider: "deepseek",
      baseUrl: deepseekBaseUrl || "https://api.deepseek.com/v1",
      model: "",
      apiKey: deepseekApiKey,
    });
  }

  if (configs.length === 0) {
    configs.push({
      label: "DeepSeek",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "",
      apiKey: undefined,
    });
  }

  return configs;
}

export function findTranslationConfig(provider?: string | null): TranslationModelConfig | null {
  const configs = loadTranslationConfigs();
  const normalizedProvider = provider === "llama" ? "llama" : provider === "deepseek" ? "deepseek" : null;
  return configs.find((item) => item.provider === normalizedProvider) ?? configs[0] ?? null;
}

export function resolveTranslationConfig(provider: TranslationModelProvider, model?: string): TranslationModelConfig {
  const baseConfig = findTranslationConfig(provider) ?? loadTranslationConfigs()[0];
  if (!baseConfig) {
    throw new Error("未找到可用翻译配置");
  }

  return {
    ...baseConfig,
    model: model?.trim() || baseConfig.model,
  };
}

export function getTranslateConfigResponse(): TranslateConfigResponse {
  const configs = loadTranslationConfigs();
  return {
    providers: configs.map(({ label, provider, model }) => ({
      label,
      provider,
      model,
    })),
  };
}
