## What changed

<!-- The behaviour difference, not the file list. -->

## Why

<!-- The problem this solves. Link an issue if there is one. -->

## Verification

- [ ] `npm run verify` passes (lint, typecheck, coverage gates, build)
- [ ] `npm run test:e2e` passes, or the change cannot affect browser flows
- [ ] New behaviour is covered by a test that fails without the change

## Trust boundary

<!-- Delete if untouched. -->

- [ ] This change touches command execution, path resolution, request validation, or the
      workspace root. If so, describe what an untrusted caller can now reach that they
      could not before.
