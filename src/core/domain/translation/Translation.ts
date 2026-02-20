import { AggregateRoot } from '../shared/AggregateRoot';
import type { TextSegment } from './TextSegment';

export interface TranslationProps {
  id: string;
  original: {
    text: string;
    languageCode: string;
    languageName: string;
    romanization: string | null;
  }[];
  translated: {
    text: string;
    languageCode: string;
    languageName: string;
    romanization: string | null;
  }[];
  description: string;
  createdAt: string;
}

export class Translation extends AggregateRoot<string> {
  constructor(
    public readonly id: string,
    public readonly original: TextSegment[],
    public readonly translated: TextSegment[],
    public readonly description: string,
    public readonly createdAt: Date,
  ) {
    super(id);
  }

  public toProps(): TranslationProps {
    return {
      id: this.id,
      original: this.original.map((s) => ({
        text: s.text,
        languageCode: s.language.code,
        languageName: s.language.name,
        romanization: s.romanization,
      })),
      translated: this.translated.map((s) => ({
        text: s.text,
        languageCode: s.language.code,
        languageName: s.language.name,
        romanization: s.romanization,
      })),
      description: this.description,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
