## 2026-04-13
- The admin browser E2E spec had to be updated to click `Edit` before touching row controls because Task 1 intentionally locked rows by default.
- This was a minimal verification-only exception to keep the Task 1 browser regression green without changing the app behavior.
## 2026-04-13
- `lsp_diagnostics` could not run because the configured TypeScript language server is not installed in this environment (`typescript-language-server` missing). I used `npm run typecheck` as the fallback verification instead.
## 2026-04-13
- FAIL: On `/admin/local-admin-secret-token`, the first row started locked and unlocked on `Edit`, but the immediate post-save snapshot after `Saved` still had one select enabled (`textarea` disabled=true, Save disabled=true, one `select` disabled=false), so the row did not fully re-lock instantly.
## 2026-04-13
- `lsp_diagnostics` is still unavailable in this environment because `typescript-language-server` is not installed, so JS/TS diagnostics could not be run despite the configured TypeScript server entry.
## 2026-04-13
- FAIL: `/admin/local-admin-secret-token` showed one row only; row 1 was `locked` with `Edit`, `Save`, `Delete` visible and `Save` disabled, then became `editing` after `Edit` (`row-editing`, `Save` enabled), but there was no second row to compare. Playwright console had one error: `favicon.ico` 404.
## 2026-04-13
- `lsp_diagnostics` remains unavailable in this environment because `typescript-language-server` is not installed, so the final verification relies on `npm run test:e2e:admin` instead.
## 2026-04-13
- `lsp_diagnostics` was attempted on `public/admin`, `test/integration`, `test/unit`, and `test/e2e`, but each attempt failed because `typescript-language-server` is not installed in this environment. Typecheck passed as the fallback static check.
## 2026-04-13
- The current environment still cannot run `lsp_diagnostics` for JS/TS files because `typescript-language-server` is missing; the fallback verification remains `npm run typecheck`.
