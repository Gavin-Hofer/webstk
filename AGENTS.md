# AGENTS.md

## Purpose and Scope

This document provides repository-wide instructions for contributors and coding agents working in `/workspace/webstk`.

## Setup

### Prerequisites

- Node.js 20+ (use the current LTS release)
- `pnpm` (preferred package manager for this repo)

### Initial setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start the development server:
   ```bash
   pnpm dev
   ```
3. Open `http://localhost:3000`.

### Pre-commit hook reliability (Husky + gitleaks-secret-scanner)

The pre-commit hook runs `lint-staged` and `pnpm tsc -noEmit`. `lint-staged` includes `gitleaks-secret-scanner`, which may try to download a Gitleaks binary from GitHub.

If your environment cannot reach GitHub releases (for example restricted egress in Codex/container environments), use this fallback so commits still run with hooks enabled:

1. Install system gitleaks:
   ```bash
   sudo apt-get update && sudo apt-get install -y gitleaks
   ```
2. Seed the scanner cache with the system binary using the wrapper fallback version path:
   ```bash
   mkdir -p ~/.gitleaks-cache/v8.30.0
   ln -sf /usr/bin/gitleaks ~/.gitleaks-cache/v8.30.0/gitleaks
   ```
3. Verify scanner execution:
   ```bash
   pnpm exec gitleaks-secret-scanner --no-banner
   ```

Codex setting note: ideally, enable outbound network access to `api.github.com` and `github.com` release assets so the scanner can auto-download binaries without manual cache seeding.

### E2E environment reliability (Playwright + Next.js font fetch)

In fresh or restricted environments, e2e can fail for two common setup reasons:

1. Missing Playwright browser binaries:
   ```bash
   pnpm exec playwright install
   ```
2. TLS/certificate issues when Next.js fetches Google Fonts during `pnpm build`:
   - Use system certificates for Turbopack by setting:
     ```bash
     NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1
     ```
   - This repository also sets that variable in `playwright.config.ts` under `webServer.env` so `pnpm test:e2e` works consistently.

### Build and quality commands

- Lint:
  ```bash
  pnpm lint
  ```
- Type check:
  ```bash
  pnpm exec tsc --noEmit
  ```
- Build:
  ```bash
  pnpm build
  ```

### Tests

- Unit tests (Vitest):
  ```bash
  pnpm test
  ```
- End-to-end tests (Playwright):
  ```bash
  pnpm test:e2e
  ```

## Guidelines

- Before checking for lint errors, run auto-fixes on modified files:
  - `pnpm exec eslint --fix <modified-files>`
  - `pnpm exec prettier --write <modified-files>`
- After autoformatting, ensure all type errors and lint errors are addressed.
- Prefer solving lint errors to disabling them (for example by adding proper type guards).
- Ensure all unit tests (Vitest) and e2e tests (Playwright) pass before finalizing changes.
- When a test failure is encountered, do not assume either the test or the implementation is correct. Use best effort to infer intended behavior, then update tests and implementation accordingly.
- Avoid mocking internal implementation details (for example, React hook internals like `useState`) wherever possible; prefer black-box behavior tests using user-level tooling such as `@testing-library/react` and `renderHook`.
- Include concise, informative JSDoc comments in exported components.
- Avoid trivial/low-value tests (for example, asserting static SVG width/height props only). Prefer tests that validate meaningful behavior, state transitions, data transformation, error handling, or integration boundaries.
- Do not add unit tests for stock shadcn utilities/components (including `cn`) unless there are significant custom modifications in this repository.
- Do not commit binary files.
- Research the latest official docs and best-practice guidance when making framework/tooling decisions.
- Document any non-obvious environment/tooling issue you hit and the working resolution in your PR summary and/or this `AGENTS.md` (when it is generally reusable).

## Test-Driven Development Workflow

1. Create a stub implementation of the feature you plan to work on, including JSDoc comments.
2. Create a set of test cases to validate the feature. Use Vitest for components/utilities and Playwright for larger features.
3. Update the code until all relevant tests pass. If you detect a problem in tests, fix tests and implementation to match intended behavior.
4. Run all unit and e2e tests. If anything breaks unexpectedly, return to step 2 and expand test coverage.

Work in small chunks. Instead of writing all tests up front, iterate feature-by-feature:

- Write tests for the next small step.
- Implement only what is needed for that step.
- Re-run tests.
- Repeat.

## Suggested AGENTS.md Maintenance Best Practices

- Keep instructions concrete, command-based, and repository-specific.
- Organize instructions under clear headings (setup, commands, workflow, constraints).
- Prefer executable examples over prose-only guidance.
- Keep file scope explicit (this file applies repo-wide unless overridden by deeper AGENTS.md files).
- Update this file whenever scripts, tooling, or expected workflows change.

## Recommended Reference Docs

Use official documentation as the source of truth:

- Next.js docs: https://nextjs.org/docs
- TypeScript handbook/docs: https://www.typescriptlang.org/docs/
- ESLint docs: https://eslint.org/docs/latest/
- Prettier docs: https://prettier.io/docs/
- Vitest docs: https://vitest.dev/guide/
- Playwright docs: https://playwright.dev/docs/intro
