import type { GenerationConfiguration } from '../transports/generation-configurations';
import type { TranslationCapabilitySupport } from '../../../../core/ports/outbound/ITranslationCapabilityStorage';

/** Choose a request configuration without owning generation or persistence. */
export class TranslationConfigurationPolicy {
  private readonly visited = new Set<string>();
  private selected: GenerationConfiguration | undefined;

  constructor(
    private readonly configurations: readonly GenerationConfiguration[],
    private readonly support: (id: string) => TranslationCapabilitySupport,
    private readonly hasEligibleMode: (id: string) => boolean,
  ) {
    this.selected = this.choose();
  }

  get current(): GenerationConfiguration | undefined {
    return this.selected;
  }

  advance(): GenerationConfiguration | undefined {
    if (this.selected) this.visited.add(this.selected.id);
    this.selected = this.choose();

    return this.selected;
  }

  private choose(): GenerationConfiguration | undefined {
    const eligible = this.configurations.filter(
      (configuration) =>
        !this.visited.has(configuration.id) &&
        this.support(configuration.id) !== 'unsupported' &&
        this.hasEligibleMode(configuration.id),
    );

    return (
      eligible.find(
        (configuration) => this.support(configuration.id) === 'supported',
      ) ?? eligible[0]
    );
  }
}
