import { resolve } from 'path';

interface ExtensionManifest {
  name: string;
  version: string;
  manifest_version: 2 | 3;
  [key: string]: unknown;
}

async function updateManifest(): Promise<void> {
  const rawVersion = process.argv[2];

  if (!rawVersion) {
    console.error(
      '❌ [update-manifest] Fatal Error: No version argument provided to script.',
    );
    process.exit(1);
  }

  // Extensions strictly require x.y.z.w (numbers only).
  // This regex strips the alphabet characters from pre-releases.
  // Example A: "1.2.0" -> "1.2.0"
  // Example B: "1.2.0-beta.1" -> "1.2.0.1"
  // Example C: "1.2.0-alpha" -> "1.2.0"
  const cleanVersion = rawVersion
    .replace(/-[a-zA-Z]+\./, '.')
    .replace(/-[a-zA-Z]+/, '');

  const manifestPath = resolve(import.meta.dir, '../manifest.json');
  const file = Bun.file(manifestPath);

  if (!(await file.exists())) {
    console.error(
      `❌ [update-manifest] Fatal Error: manifest.json not found at ${manifestPath}`,
    );
    process.exit(1);
  }

  const manifest: ExtensionManifest = await file.json();
  console.log(
    `[update-manifest] Syncing manifest.json: ${manifest.version} -> ${cleanVersion} (Raw: ${rawVersion})`,
  );

  manifest.version = cleanVersion;

  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log('✅ [update-manifest] Manifest version successfully updated.');
}

updateManifest().catch((err) => {
  console.error('❌ [update-manifest] Unhandled execution failure:', err);
  process.exit(1);
});
