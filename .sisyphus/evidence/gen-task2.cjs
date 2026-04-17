const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const evidenceDir = path.join(process.cwd(), '.sisyphus', 'evidence');

// Task 2 invalid CSV
const invalidCsv = 'Name,Role\nAlice,student\nBob,Admin\n"Carol,Comma,Malformed\n';
const invalidPath = path.join(evidenceDir, 'task-2-invalid-fixture.csv');
fs.writeFileSync(invalidPath, invalidCsv);

try {
  execSync('node ./scripts/import-users.mjs --csv .sisyphus/evidence/task-2-invalid-fixture.csv --base-url https://absen-qr.rif42.workers.dev --dry-run --output .sisyphus/evidence/task-2-invalid-out.json', { encoding: 'utf-8', stdio: 'pipe' });
} catch (e) {
  fs.writeFileSync(path.join(evidenceDir, 'task-2-invalid-csv.txt'), e.stdout || e.message);
}

console.log('task-2-invalid-csv.txt generated');
