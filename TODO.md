# TODO

## CI/CD

- [ ] **Re-add Firefox AMO publish to `release.config.mjs`**
  - Removed because the Chrome Web Store item is stuck in "pending review" and the chained command (`&&`) causes the entire publish step to fail, blocking Firefox too.
  - Once the Chrome review clears, re-add:
    ```
    && npx web-ext sign --source-dir dist/firefox --channel listed --approval-timeout 0 --api-key $AMO_JWT_ISSUER --api-secret $AMO_JWT_SECRET
    ```
  - Consider splitting Chrome and Firefox publish into **separate commands** so one failing doesn't block the other.
