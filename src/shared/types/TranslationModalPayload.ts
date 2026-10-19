import type { Translation } from '../../core/domain/translation/Translation';

export interface TranslationSegmentPayload {
  language: { code: string; name: string };
  text: string;
  romanization: string | null;
  blockIndex: number;
}
export interface TranslationModalPayload {
  id: string;
  original: TranslationSegmentPayload[];
  translated: TranslationSegmentPayload[];
  description: string;
  createdAt: Date;
}
function serializeSegments(segments: Translation['original']): TranslationSegmentPayload[] {
  return (
    segments.map((segment) => ({
      language: { code: segment.language.code, name: segment.language.name },
      text: segment.text,
      romanization: segment.romanization,
      blockIndex: segment.blockIndex,
    }))
  );
}
/** Framework-free serialization shared by background, history and injected UI. */
export function serializeForModal(translation: Translation): TranslationModalPayload {
  return {
    id: translation.id, original: serializeSegments(translation.original),
    translated: serializeSegments(translation.translated), description: translation.description,
    createdAt: translation.createdAt,
  };
}
