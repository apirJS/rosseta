/** Provider-neutral request modes, in the existing fallback preference order. */
export type GenerationMode =
  | 'structured-stream'
  | 'plain-stream'
  | 'structured-buffered'
  | 'plain-buffered';

export const GENERATION_MODES: readonly GenerationMode[] = [
  'structured-stream',
  'plain-stream',
  'structured-buffered',
  'plain-buffered',
];

export const isStructured = (mode: GenerationMode) =>
  mode.startsWith('structured');

export const isStreamed = (mode: GenerationMode) => mode.endsWith('stream');

export function bufferedMode(mode: GenerationMode): GenerationMode {
  return isStructured(mode) ? 'structured-buffered' : 'plain-buffered';
}
