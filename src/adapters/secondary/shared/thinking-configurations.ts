import {
  PROVIDER_DEFAULT_CONFIGURATION,
  type ThinkingConfiguration,
  type ThinkingContext,
} from "./generation-configurations";
import { nativeThinkingConfigurations } from "./native-thinking-configurations";
import { gatewayThinkingConfigurations } from "./gateway-thinking-configurations";

export function thinkingConfigurations(
  context: ThinkingContext,
): readonly ThinkingConfiguration[] {
  return (
    gatewayThinkingConfigurations(context) ??
    nativeThinkingConfigurations(context) ??
    (context.protocol === "anthropic"
      ? nativeThinkingConfigurations({ ...context, provider: "anthropic" })
      : undefined) ?? [PROVIDER_DEFAULT_CONFIGURATION]
  );
}
