import type { generateText, LanguageModel } from "ai";

/** Adapter-local request variants; identities are opaque to persistence/core. */
export interface GenerationConfiguration {
  id: string;
  rejectionFields: readonly string[];
}

export type SdkProviderOptions = NonNullable<
  Parameters<typeof generateText>[0]["providerOptions"]
>;

export interface ThinkingConfiguration extends GenerationConfiguration {
  intent: "disabled" | "minimum" | "provider-default";
  reasoning?: Parameters<typeof generateText>[0]["reasoning"];
  providerOptions?: SdkProviderOptions;
  requestBody?: Readonly<Record<string, unknown>>;
  puterEffort?: string;
}

export interface ThinkingContext {
  provider: string;
  modelId: string;
  baseURL?: string;
  providerName?: string;
  protocol?: string;
}

export const PROVIDER_DEFAULT_CONFIGURATION: ThinkingConfiguration = {
  id: "thinking.provider-default.v1",
  rejectionFields: [],
  intent: "provider-default",
};

export type ConfiguredModelFactory = (
  configuration: ThinkingConfiguration,
) => LanguageModel;
