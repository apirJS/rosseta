import type { TranslationDraft } from '../../../../../core/ports/outbound/TranslationExecutionOptions';
import { LANGUAGE_MAP } from '../../../../../core/domain/translation/LANGUAGE_MAP';
import type { TranslationSegmentPayload } from '../../../../../shared/types/TranslationModalPayload';

export interface SegmentPayload extends TranslationSegmentPayload {
  index?: number;
  rowKey?: string;
}

export interface IndexedSegmentPayload extends SegmentPayload {
  index: number;
}

function sourceLanguage(code: string | null): SegmentPayload['language'] {
  return code && Object.hasOwn(LANGUAGE_MAP, code)
    ? { code, name: LANGUAGE_MAP[code as keyof typeof LANGUAGE_MAP] }
    : { code: 'unknown', name: '' };
}

/** Live rows use array positions until the final validated block grouping arrives. */
export function mapDraftSegments(
  draft: TranslationDraft,
  targetLanguage: SegmentPayload['language'],
  revision: number,
): { original: SegmentPayload[]; translated: SegmentPayload[] } {
  const original: SegmentPayload[] = [];
  const translated: SegmentPayload[] = [];

  for (const segment of draft.segments) {
    const row = {
      blockIndex: segment.index,
      index: segment.index,
      rowKey: revision + ':' + segment.index,
    };

    original.push({
      ...row,
      language: sourceLanguage(segment.sourceLanguageCode),
      text: segment.originalText,
      romanization: segment.romanization,
    });

    translated.push({
      ...row,
      language: targetLanguage,
      text: segment.translatedText,
      romanization: null,
    });
  }

  return { original, translated };
}

export function groupSegmentsIntoBlocks(
  segments: SegmentPayload[],
): IndexedSegmentPayload[][] {
  const blocks: IndexedSegmentPayload[][] = [];

  for (const [index, segment] of segments.entries()) {
    const indexed = { ...segment, index: segment.index ?? index };
    const previousBlock = blocks[blocks.length - 1];

    if (previousBlock?.[0].blockIndex === segment.blockIndex) {
      previousBlock.push(indexed);
    } else {
      blocks.push([indexed]);
    }
  }

  return blocks;
}

export function joinSegmentBlocks(blocks: IndexedSegmentPayload[][]): string {
  return blocks
    .map((block) => block.map((segment) => segment.text).join(' '))
    .join('\n');
}
