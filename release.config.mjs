/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  // 1. The Branch Strategy
  branches: [
    'main', // Stable releases (e.g., v1.0.0)
    { name: 'beta', prerelease: true }, // Testing releases (e.g., v1.0.0-beta.1)
  ],

  // 2. The Plugin Pipeline (Order is absolutely critical)
  plugins: [
    // Analyze commits to determine Patch, Minor, or Major
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
      },
    ],

    // Generate the release notes based on the analyzed commits
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
      },
    ],

    // Write the release notes into CHANGELOG.md
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],

    // Bump the version in package.json (We disable publishing to the npm registry)
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],

    // The Custom Bun Pipeline: Update manifest, sync lockfile, build, and zip
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          'bun scripts/update-manifest.ts ${nextRelease.version} && bun install && bun run build:prod && (cd dist/chrome && zip -r ../../chrome-v${nextRelease.version}.zip .) && (cd dist/firefox && zip -r ../../firefox-v${nextRelease.version}.zip .)',
        publishCmd:
          'npx chrome-webstore-upload-cli@3 upload --source chrome-v${nextRelease.version}.zip && npx web-ext sign --source-dir dist/firefox --channel listed --api-key $AMO_JWT_ISSUER --api-secret $AMO_JWT_SECRET',
      },
    ],

    // Stage and commit the changed files back to the repository
    [
      '@semantic-release/git',
      {
        // Note: If you use Bun v1.2+, the lockfile is usually bun.lock. For older versions, it is bun.lockb.
        assets: ['package.json', 'bun.lock', 'manifest.json', 'CHANGELOG.md'],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],

    // Create the GitHub Release and upload the generated Zip file
    [
      '@semantic-release/github',
      {
        assets: [
          { path: 'chrome-v*.zip', label: 'Chrome Extension (Zip)' },
          { path: 'firefox-v*.zip', label: 'Firefox Extension (Zip)' },
        ],
      },
    ],
  ],
};
