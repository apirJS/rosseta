/* eslint-disable no-await-in-loop -- Provider attempts and ordered chunk handling depend on preceding results. */
import type {
  GenerationEvent,
  GenerationRequest,
  GenerationResult,
  ITranslationGenerationTransport,
  GenerationMode,
} from '../../src/adapters/secondary/shared/ITranslationGenerationTransport';
export interface ScriptedGeneration {
  events?: GenerationEvent[];
  result?: GenerationResult;
  error?: unknown;
  wait?: Promise<void>;
}
export class FakeStreamingGeneration implements ITranslationGenerationTransport {
  readonly requests: GenerationRequest[] = [];
  supportedModes?: readonly GenerationMode[];
  constructor(readonly scripts: ScriptedGeneration[]) {}
  async generate(
    request: GenerationRequest,
    onEvent: (event: GenerationEvent) => Promise<void>,
  ): Promise<GenerationResult> {
    this.requests.push(request);
    const script = this.scripts.shift();
    if (!script) throw new Error('No scripted provider response');

    for (const event of script.events ?? []) await onEvent(event);
    
    if (script.wait) await script.wait;
    if (script.error) throw script.error;
    if (!script.result) throw new Error('No scripted result');
    return script.result;
  }
}
