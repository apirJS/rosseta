import {
  PROVIDER_DEFAULT_CONFIGURATION,
  type ThinkingConfiguration,
  type ThinkingContext,
} from "./generation-configurations";

const DEFAULT_ONLY = [PROVIDER_DEFAULT_CONFIGURATION];

/** Verified gateway controls. An unfamiliar model/endpoint keeps its own default. */
export function gatewayThinkingConfigurations(
  context: ThinkingContext,
): readonly ThinkingConfiguration[] | undefined {
  // A custom Anthropic client serializes Anthropic options, not chat-completion fields.
  if (context.protocol === "anthropic") return undefined;
  const provider = gatewayProvider(context);
  const model = context.modelId.toLowerCase();
  const namespace = context.providerName?.split(".")[0].trim() ?? provider;

  switch (provider) {
    case "deepinfra":
      return deepInfraConfigurations(model, namespace);
    case "zai":
      return zaiConfigurations(model, namespace);
    case "openrouter":
      return openRouterConfigurations(model, namespace);
    case "nvidia":
      return nvidiaConfigurations(model, namespace);
    case "huggingface":
      return huggingFaceConfigurations(model, namespace);
    case "puter":
      return puterConfigurations(model);
    case "opencode":
      // Zen documents model-specific protocols, not a universal thinking switch.
      return DEFAULT_ONLY;
    case "deepseek":
      // The native adapter has its own profile; this handles custom endpoints.
      return context.provider === "deepseek"
        ? undefined
        : deepSeekConfigurations(model, namespace);
    default:
      return undefined;
  }
}

function gatewayProvider(context: ThinkingContext): string {
  if (!context.baseURL) return context.provider;

  let hostname: string;
  try {
    hostname = new URL(context.baseURL).hostname.toLowerCase();
  } catch {
    return context.provider;
  }

  const hosts: Record<string, string> = {
    "api.deepinfra.com": "deepinfra",
    "api.z.ai": "zai",
    "openrouter.ai": "openrouter",
    "integrate.api.nvidia.com": "nvidia",
    "router.huggingface.co": "huggingface",
    "opencode.ai": "opencode",
    "api.deepseek.com": "deepseek",
  };

  return hosts[hostname] ?? context.provider;
}

function deepInfraConfigurations(
  model: string,
  namespace: string,
): readonly ThinkingConfiguration[] {
  if (/^zai-org\/glm-5\.3(?:-flashx?)?$/.test(model)) {
    return effortConfigurations(namespace, "low", "minimum");
  }

  const hybridModels = [
    "qwen/qwen3.8-27b",
    "nvidia/nemotron-3.5-super-vl-120b-a12b",
    "deepseek-ai/deepseek-v4-flash-0731",
    "deepseek-ai/deepseek-v4-pro-0813",
    "deepseek-ai/deepseek-v4.1-flash",
    "deepseek-ai/deepseek-v4.1-flash-1017",
    "zai-org/glm-5.2",
    "moonshotai/kimi-k3",
    "inclusionai/ling-3.0-flash",
  ];

  if (hybridModels.includes(model)) {
    return effortWithMinimum(namespace);
  }

  return DEFAULT_ONLY;
}

function zaiConfigurations(
  model: string,
  namespace: string,
): readonly ThinkingConfiguration[] {
  if (/^glm-5\.3(?:-flashx?)?$/.test(model))
    return effortConfigurations(namespace, "low", "minimum");

  if (
    /^glm-(?:4\.[567](?:v|-air|-flash|-airx)?|5(?:\.[12])?(?:-code)?)$/.test(
      model,
    )
  ) {
    return withDefault(
      providerConfiguration(
        namespace,
        "disabled",
        { thinking: { type: "disabled" } },
        ["thinking"],
      ),
    );
  }

  return DEFAULT_ONLY;
}

function openRouterConfigurations(
  model: string,
  namespace: string,
): readonly ThinkingConfiguration[] {
  const name = model.split(":")[0];
  // Mandatory families have no off mode. Do not label output exclusion as off.
  if (
    /^openai\/(?:gpt-oss-(?:20b|120b)|o(?:1|3|3-mini|4-mini)|gpt-6(?:\.1)?-astra|gpt-6\.1-sol)$/.test(
      name,
    ) ||
    /^z-ai\/glm-5\.3(?:-flashx?)?$/.test(name) ||
    /^anthropic\/claude-(?:fable-5(?:\.1)?|mythos-5(?:\.1)?|mythos-preview|opus-5\.5|sonnet-5\.5)$/.test(
      name,
    ) ||
    /^google\/gemini-(?:3(?:\.1)?-pro(?:-preview)?|3\.[78]-flash|4-argon)$/.test(
      name,
    ) ||
    /^x-ai\/grok-4\.[567](?:-fast)?$/.test(name)
  ) {
    return nestedEffortConfigurations(namespace, "low", "minimum");
  }

  if (
    /^openai\/gpt-5(?:-(?:mini|nano))?$/.test(name) ||
    /^google\/gemini-3(?:\.[1356])?-flash(?:-lite)?(?:-preview)?$/.test(name)
  ) {
    return nestedEffortConfigurations(namespace, "minimal", "minimum");
  }

  if (/^openai\/gpt-5\.[245]-pro$/.test(name))
    return nestedEffortConfigurations(namespace, "medium", "minimum");

  if (name === "google/gemini-2.5-pro") {
    return withDefault(
      providerConfiguration(
        namespace,
        "minimum",
        { reasoning: { max_tokens: 128 } },
        ["reasoning"],
      ),
    );
  }

  if (
    /^openai\/gpt-(?:5\.[1245](?:-(?:mini|nano))?|5\.6-(?:sol|terra|luna)|6-(?:sol|luna))$/.test(
      name,
    ) ||
    /^x-ai\/grok-4\.3(?:-fast)?$/.test(name)
  ) {
    return nestedEffortWithMinimum(namespace);
  }

  if (
    /^qwen\/qwen3\.5-(?:397b-a17b|122b-a10b)$/.test(name) ||
    name === "qwen/qwen3.8-27b" ||
    /^google\/gemini-2\.5-flash(?:-lite)?$/.test(name) ||
    /^anthropic\/claude-(?:(?:opus|sonnet|haiku)-4\.5|opus-4\.[678]|sonnet-4\.6|(?:opus|sonnet)-5|haiku-5\.5)$/.test(
      name,
    ) ||
    /^z-ai\/glm-(?:4\.[567](?:v|-air)?|5(?:\.[12])?)$/.test(name)
  ) {
    return nestedEffortConfigurations(namespace, "none", "disabled");
  }

  return DEFAULT_ONLY;
}

function nvidiaConfigurations(
  model: string,
  namespace: string,
): readonly ThinkingConfiguration[] {
  if (/^moonshotai\/kimi-k2\.[56]$/.test(model)) {
    return withDefault(
      providerConfiguration(
        namespace,
        "disabled",
        { chat_template_kwargs: { thinking: false } },
        ["chat_template_kwargs", "thinking"],
      ),
    );
  }

  if (model === "nvidia/nemotron-3-super-120b-a12b") {
    return effortWithMinimum(namespace);
  }

  if (model === "nvidia/nemotron-3.5-super-vl-120b-a12b") {
    return [
      templateThinkingDisabled(namespace),
      providerConfiguration(namespace, "minimum", { reasoningEffort: "low" }, [
        "reasoning_effort",
      ]),
      PROVIDER_DEFAULT_CONFIGURATION,
    ];
  }

  const templateModels = [
    "qwen/qwen3.5-122b-a10b",
    "nvidia/nemotron-3-nano-30b-a3b",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "nvidia/nemotron-3-ultra-550b-a55b",
    "z-ai/glm4.7",
  ];

  if (templateModels.includes(model)) {
    return withDefault(templateThinkingDisabled(namespace));
  }

  if (model === "meta/muse-glimmer-30b") {
    return withDefault(
      providerConfiguration(
        namespace,
        "minimum",
        { chat_template_kwargs: { reasoning_strength: "low" } },
        ["chat_template_kwargs", "reasoning_strength"],
      ),
    );
  }

  // Older Nemotron's /no_think is a prompt convention, not a native API setting.
  return DEFAULT_ONLY;
}

function huggingFaceConfigurations(
  model: string,
  namespace: string,
): readonly ThinkingConfiguration[] {
  if (/^openai\/gpt-oss-(?:20b|120b)(?::.*)?$/.test(model)) {
    return withDefault(
      providerConfiguration(namespace, "minimum", { reasoningEffort: "low" }, [
        "reasoning",
        "reasoning_effort",
      ]),
    );
  }

  return DEFAULT_ONLY;
}

function deepSeekConfigurations(
  model: string,
  namespace: string,
): readonly ThinkingConfiguration[] {
  if (/^deepseek-(?:flash|v4-pro|v4-flash(?:-vision-exp)?)$/.test(model)) {
    return [
      providerConfiguration(
        namespace,
        "disabled",
        { thinking: { type: "disabled" } },
        ["thinking"],
      ),
      providerConfiguration(
        namespace,
        "minimum",
        { thinking: { type: "enabled" }, reasoningEffort: "low" },
        ["thinking", "reasoning_effort"],
      ),
      PROVIDER_DEFAULT_CONFIGURATION,
    ];
  }

  return DEFAULT_ONLY;
}

function puterConfigurations(
  modelId: string,
): readonly ThinkingConfiguration[] {
  const parts = modelId.split("/");
  if (
    parts.length > 2 ||
    (parts.length === 2 && !["openai", "google", "meta"].includes(parts[0]))
  )
    return DEFAULT_ONLY;

  const model = parts.at(-1) ?? modelId;
  if (
    parts.length === 2 &&
    ((parts[0] === "google" && !model.startsWith("gemini-")) ||
      (parts[0] === "meta" && !model.startsWith("muse-spark")) ||
      (parts[0] === "openai" && !/^(?:gpt-|o[134])/.test(model)))
  )
    return DEFAULT_ONLY;
  if (/^gemini-(?:3-flash-preview|3\.1-flash-lite)(?:$|-)/.test(model)) {
    return puterEffortConfiguration("minimal", "minimum");
  }

  if (model === "gemini-4-argon" || /^muse-spark(?:$|-)/.test(model)) {
    return puterEffortConfiguration("low", "minimum");
  }

  if (
    /^(?:o(?:1|3|3-mini|4-mini)|gpt-oss-(?:20b|120b)|gpt-6-astra|gpt-6\.1-sol|gpt-5\.3-codex)(?:-\d{4}-\d{2}-\d{2})?$/.test(
      model,
    )
  ) {
    return puterEffortConfiguration("low", "minimum");
  }

  if (/^gpt-5(?:-(?:mini|nano))?(?:-\d{4}-\d{2}-\d{2})?$/.test(model))
    return puterEffortConfiguration("minimal", "minimum");

  if (/^gpt-5\.[245]-pro$/.test(model))
    return puterEffortConfiguration("medium", "minimum");

  if (
    /^gpt-(?:5\.[1245](?:-(?:mini|nano))?|5\.6-(?:sol|terra|luna)|6-(?:sol|luna))(?:-\d{4}-\d{2}-\d{2})?$/.test(
      model,
    )
  ) {
    return [
      puterEffort("none", "disabled"),
      puterEffort("low", "minimum"),
      PROVIDER_DEFAULT_CONFIGURATION,
    ];
  }
  return DEFAULT_ONLY;
}

function puterEffortConfiguration(
  effort: string,
  intent: ThinkingConfiguration["intent"],
): readonly ThinkingConfiguration[] {
  return withDefault(puterEffort(effort, intent));
}

function puterEffort(
  effort: string,
  intent: ThinkingConfiguration["intent"],
): ThinkingConfiguration {
  return {
    id: `thinking.puter.${effort}.v1`,
    rejectionFields: ["reasoning_effort", "reasoning"],
    intent,
    puterEffort: effort,
  };
}

function effortConfigurations(
  namespace: string,
  effort: string,
  intent: ThinkingConfiguration["intent"],
): readonly ThinkingConfiguration[] {
  return withDefault(
    providerConfiguration(namespace, intent, { reasoningEffort: effort }, [
      "reasoning_effort",
    ]),
  );
}

function effortWithMinimum(
  namespace: string,
): readonly ThinkingConfiguration[] {
  return [
    providerConfiguration(namespace, "disabled", { reasoningEffort: "none" }, [
      "reasoning_effort",
    ]),
    providerConfiguration(namespace, "minimum", { reasoningEffort: "low" }, [
      "reasoning_effort",
    ]),
    PROVIDER_DEFAULT_CONFIGURATION,
  ];
}

function nestedEffortConfigurations(
  namespace: string,
  effort: string,
  intent: ThinkingConfiguration["intent"],
): readonly ThinkingConfiguration[] {
  return withDefault(
    providerConfiguration(namespace, intent, { reasoning: { effort } }, [
      "reasoning",
    ]),
  );
}

function nestedEffortWithMinimum(
  namespace: string,
): readonly ThinkingConfiguration[] {
  return [
    providerConfiguration(
      namespace,
      "disabled",
      { reasoning: { effort: "none" } },
      ["reasoning"],
    ),
    providerConfiguration(
      namespace,
      "minimum",
      { reasoning: { effort: "low" } },
      ["reasoning"],
    ),
    PROVIDER_DEFAULT_CONFIGURATION,
  ];
}

function templateThinkingDisabled(namespace: string): ThinkingConfiguration {
  return providerConfiguration(
    namespace,
    "disabled",
    { chat_template_kwargs: { enable_thinking: false } },
    ["chat_template_kwargs", "enable_thinking"],
  );
}

function providerConfiguration(
  namespace: string,
  intent: ThinkingConfiguration["intent"],
  options: Record<string, unknown>,
  rejectionFields: readonly string[],
): ThinkingConfiguration {
  return {
    id: `thinking.${namespace}.${JSON.stringify(options)}.v1`,
    rejectionFields,
    intent,
    providerOptions: {
      [namespace]: options as NonNullable<
        ThinkingConfiguration["providerOptions"]
      >[string],
    },
  };
}

function withDefault(
  configuration: ThinkingConfiguration,
): readonly ThinkingConfiguration[] {
  return [configuration, PROVIDER_DEFAULT_CONFIGURATION];
}
