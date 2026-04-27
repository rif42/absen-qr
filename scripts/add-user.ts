import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const name = args[0];
const role = args[1];

if (!name || !role) {
  console.error("Usage: bun run scripts/add-user.ts <name> <role>");
  console.error("Example: bun run scripts/add-user.ts \"John Doe\" mentor");
  process.exit(1);
}

if (role !== "mentor" && role !== "student") {
  console.error("Role must be 'mentor' or 'student'");
  process.exit(1);
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const slugifiedName = slugify(name);
const personId = `${role}-${slugifiedName}`;
const secretId = `${role}-secret-${slugifiedName}`;

// Generate 12 char alphanumeric token
const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
let secretPathToken = "";
for (let i = 0; i < 12; i++) {
  secretPathToken += chars.charAt(Math.floor(Math.random() * chars.length));
}

const secretLink = `https://absen-qr.rif42.workers.dev/${role}/${secretPathToken}`;

console.log(`Adding ${role}: ${name}`);
console.log(`Person ID: ${personId}`);
console.log(`Secret Path: ${secretPathToken}`);
console.log(`Secret Link: ${secretLink}`);
console.log("-----------------------------------------");

// 1. Update CSV
const escapedNameForCsv = name.includes(',') || name.includes('"') 
  ? `"${name.replace(/"/g, '""')}"` 
  : name;
  
const csvLine = `${personId},${escapedNameForCsv},${role},${secretId},${secretPathToken},${secretLink}\n`;
const csvPath = path.resolve("people_export.csv");
fs.appendFileSync(csvPath, csvLine);
console.log(`\n✅ Appended to ${csvPath}`);

// 2. Insert to DB
const escapedNameForSql = name.replace(/'/g, "''");
const sql = `INSERT INTO people (person_id, display_name, role, secret_id, secret_path_token) VALUES ('${personId}', '${escapedNameForSql}', '${role}', '${secretId}', '${secretPathToken}');`;

try {
  console.log("\n🚀 Applying to local D1...");
  execSync(`bunx wrangler d1 execute DB --local --command "${sql}"`, { stdio: "inherit" });
  
  console.log("\n☁️  Applying to remote D1...");
  execSync(`bunx wrangler d1 execute DB --remote --command "${sql}"`, { stdio: "inherit" });
  
  console.log("\n🎉 Success! User added successfully.");
} catch (e) {
  console.error("\n❌ Error executing wrangler command:", e);
  process.exit(1);
}
