const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const evidenceDir = path.join(process.cwd(), '.sisyphus', 'evidence');

// Task 3 tests
const testSuites = [
  'test/integration/student-api.test.ts',
  'test/integration/mentor-api.test.ts',
  'test/integration/admin-api.test.ts',
  'test/integration/worker-smoke.test.ts',
  'test/unit/mock-d1.test.ts',
  'test/unit/mock-d1-admin.test.ts',
  'test/unit/admin-records.test.ts',
  'test/unit/secret-links.test.ts'
].join(' ');

try {
  const out = execSync(`npx vitest run ${testSuites}`, { encoding: 'utf-8', stdio: 'pipe' });
  fs.writeFileSync(path.join(evidenceDir, 'task-3-tests.txt'), out);
} catch (e) {
  fs.writeFileSync(path.join(evidenceDir, 'task-3-tests.txt'), e.stdout || e.message);
}

// Task 3 admin export
const adminOut = execSync('npx vitest run test/integration/admin-api.test.ts', { encoding: 'utf-8', stdio: 'pipe' });
fs.writeFileSync(path.join(evidenceDir, 'task-3-admin-export.txt'), adminOut);

console.log('task-3 evidence generated');
