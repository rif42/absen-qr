
- TypeScript tests do not natively understand imports from the new `.mjs` script under the current `allowJs: false` config, so the focused Vitest file uses a typed dynamic import helper instead of static TS module resolution.
- Verification note: repo-wide `rtk npm test` currently fails in pre-existing admin page DOM/app suites unrelated to `scripts/import-users.mjs`; targeted importer tests, typecheck, and worker API regression suites passed.
- The CSV writer only quotes fields when required by CSV rules, so rows like `Mentor One` stay unquoted while comma-containing names remain quoted; the round-trip test now checks the exact expected quoting behavior.
- `--write-csv` rewrites the source file directly during dry-run, so repeated verification must compare the rewritten file after each pass rather than expecting a separate temp output.
- Real-roster fixture alignment exposed an admin export gotcha: local fixtures previously avoided CSV quoting because `Student Local ##` / `Mentor Local ##` contained no commas, but the selected real roster does, so admin export assertions must compare against escaped CSV rows instead of naive plain-string joins.

- Wrangler d1 execute --remote --json --file ... is not stdout-clean on this setup: it prepends progress lines such as + Checking if file needs uploading before the JSON payload, so the importer now strips non-JSON preamble before parsing machine-readable results.

- A misleading Task 4 verification failure came from reusing wrangler d1 export twice with different filenames: both files were full-database exports. The fix switched backups to explicit per-table Wrangler queries plus JSON snapshot files so backup contents now match their filenames.
