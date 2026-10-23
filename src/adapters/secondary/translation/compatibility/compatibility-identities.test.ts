import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import baseline from './compatibility-identities.fixture.json';
import { capabilityDigest, modelScopeKey } from './translation-capability-key';
import { createGenerationResponseSchema } from '../output/translation-schema';
import { thinkingConfigurations } from '../../providers/thinking/thinking-configurations';

describe('Adapter: preserved compatibility identity', () => {
  for (const fixture of baseline.schemaFingerprints) {
    test(`schema fingerprint with description ${fixture.includeDescription}`, async () => {
      const schema = z.toJSONSchema(
        createGenerationResponseSchema(fixture.includeDescription),
        { target: 'draft-07', io: 'input' },
      );

      expect(await capabilityDigest(schema)).toBe(fixture.digest);
    });
  }

  for (const fixture of baseline.identities) {
    test(`model identity ${fixture.context.providerId}/${fixture.context.protocol}`, async () => {
      expect(await modelScopeKey(fixture.context)).toBe(fixture.digest);
    });
  }

  for (const fixture of baseline.configurations) {
    test(`configuration identity ${fixture.context.provider}/${fixture.context.modelId}`, () => {
      expect(
        thinkingConfigurations(fixture.context).map(
          (configuration) => configuration.id,
        ),
      ).toEqual(fixture.ids);
    });
  }
});
