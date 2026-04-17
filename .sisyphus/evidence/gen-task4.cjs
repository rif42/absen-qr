const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const evidenceDir = path.join(process.cwd(), '.sisyphus', 'evidence');

// Task 4 apply failure simulation: force a backup directory to be read-only so pre-apply backup write fails
const backupDir = path.join(evidenceDir, 'task-4-fail-backup');
if (fs.existsSync(backupDir)) {
  fs.rmSync(backupDir, { recursive: true, force: true });
}
fs.mkdirSync(backupDir, { recursive: true });
fs.chmodSync(backupDir, 0o555);

try {
  execSync('node ./scripts/import-users.mjs --csv ./userlist.csv --base-url https://absen-qr.rif42.workers.dev --backup-remote --apply-remote --output .sisyphus/evidence/task-4-apply-failure-out.json', { encoding: 'utf-8', stdio: 'pipe' });
  // If it somehow succeeds, write a note
  fs.writeFileSync(path.join(evidenceDir, 'task-4-apply-failure.txt'), 'Unexpected success: apply did not fail as expected.\n');
} catch (e) {
  fs.writeFileSync(path.join(evidenceDir, 'task-4-apply-failure.txt'), e.stdout || e.message);
}

// Restore permissions so cleanup is possible later
fs.chmodSync(backupDir, 0o755);

console.log('task-4-apply-failure.txt generated');
