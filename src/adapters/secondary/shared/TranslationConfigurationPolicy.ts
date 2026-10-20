import type { GenerationConfiguration } from './generation-configurations';
import type { TranslationCapabilitySupport } from '../../../core/ports/outbound/ITranslationCapabilityStorage';

/** Choose a request configuration without owning generation or persistence. */
export class TranslationConfigurationPolicy {
  private readonly rejected = new Set<string>();
  private selected: GenerationConfiguration | undefined;

  constructor(
    private readonly configurations: readonly GenerationConfiguration[],
    private readonly support: (id: string) => TranslationCapabilitySupport,
  ) {
    this.selected = this.choose();
  }

  get current(): GenerationConfiguration | undefined {
    return this.selected;
  }

  rejectCurrent(): GenerationConfiguration | undefined {
    if (this.selected) this.rejected.add(this.selected.id);
    this.selected = this.choose();
    return this.selected;
  }

  private choose(): GenerationConfiguration | undefined {
    const eligible = this.configurations.filter(
      (configuration) =>
        !this.rejected.has(configuration.id) &&
        this.support(configuration.id) !== 'unsupported',
    );
    return (
      eligible.find(
        (configuration) => this.support(configuration.id) === 'supported',
      ) ?? eligible[0]
    );
  }
}
