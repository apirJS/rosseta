# TODO

## Re-enable Firefox AMO Publish

**Status:** Blocked — Firefox add-on listing is pending review on AMO.

**Context:**
The `web-ext sign --channel listed` command fails with `"Duplicate add-on ID found"` because the initial Rosseta listing is still pending approval on addons.mozilla.org.

**When ready:**

1. Confirm the add-on is approved on [AMO Developer Hub](https://addons.mozilla.org/en-US/developers/addons)
2. Add back the Firefox publish command in `release.config.mjs`:
   ```js
   publishCmd:
     'npx chrome-webstore-upload-cli@3 upload --source chrome-v${nextRelease.version}.zip && npx web-ext sign --source-dir dist/firefox --channel listed --api-key $AMO_JWT_ISSUER --api-secret $AMO_JWT_SECRET',
   ```
3. Ensure `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` secrets are set in GitHub repo settings
4. Push a new commit to trigger a release and verify Firefox publish works
