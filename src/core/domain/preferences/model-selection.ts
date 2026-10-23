export interface ModelSelectionInput {
  savedModelId?: string;
  defaultModelId: string;
  availableModels: ReadonlyArray<{ id: string }>;
}

/** Resolve a model from explicit inputs; callers own empty-catalog presentation and writes. */
export function resolveModelId({
  savedModelId,
  defaultModelId,
  availableModels,
}: ModelSelectionInput): string {
  if (availableModels.length === 0) return savedModelId ?? defaultModelId;

  if (
    savedModelId &&
    availableModels.some((model) => model.id === savedModelId)
  ) {
    return savedModelId;
  }

  if (
    defaultModelId &&
    availableModels.some((model) => model.id === defaultModelId)
  ) {
    return defaultModelId;
  }

  return availableModels[0].id;
}
