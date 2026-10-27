export function formatTranslationStatus(status: string, busy: boolean): string {
  return busy ? status.replace(/(?:\.{3}|…)$/, '') : status;
}
