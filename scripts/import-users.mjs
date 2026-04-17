import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { parse } from "csv-parse/sync";

const ALLOWED_ROLES = new Set(["student", "mentor"]);
const ROLE_LIMIT = 10;
const OUTPUT_ENCODING = "utf8";
const WRANGLER_CONFIG_PATH = "wrangler.jsonc";
const execFile = promisify(execFileCallback);
const require = createRequire(import.meta.url);
const WRANGLER_BIN_PATH = require.resolve("wrangler/bin/wrangler.js");

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDisplayName(value) {
  return normalizeWhitespace(value);
}

function normalizeRole(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function slugifyName(value) {
  const slug = normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!slug) {
    throw new Error(`Unable to generate slug from name: ${JSON.stringify(value)}`);
  }

  return slug;
}

function createPersonIdentity(role, slug) {
  return {
    person_id: `${role}-${slug}`,
    secret_id: `${role}-secret-${slug}`,
    secret_path_token: `${role}-${slug}`
  };
}

function buildProductionLink(baseUrl, role, secretPathToken) {
  const url = new URL(baseUrl);
  url.pathname = `/${role}/${secretPathToken}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function escapeCsvValue(value) {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function escapeSqlValue(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function stripJsonComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function sortPeopleRows(rows) {
  return [...rows].sort((left, right) => left.person_id.localeCompare(right.person_id));
}

function toDatabasePeopleRows(selectedRows) {
  return sortPeopleRows(
    selectedRows.map((row) => ({
      person_id: row.person_id,
      display_name: row.display_name,
      role: row.role,
      secret_id: row.secret_id,
      secret_path_token: row.secret_path_token
    }))
  );
}

function isSamePeopleRoster(leftRows, rightRows) {
  if (leftRows.length !== rightRows.length) {
    return false;
  }

  return leftRows.every((leftRow, index) => {
    const rightRow = rightRows[index];
    return (
      leftRow.person_id === rightRow.person_id &&
      leftRow.display_name === rightRow.display_name &&
      leftRow.role === rightRow.role &&
      leftRow.secret_id === rightRow.secret_id &&
      leftRow.secret_path_token === rightRow.secret_path_token
    );
  });
}

function countTokenChanges(canonicalRows, remoteRows) {
  const remoteByPersonId = new Map(remoteRows.map((row) => [row.person_id, row]));
  let tokenChanges = 0;

  for (const canonicalRow of canonicalRows) {
    const remoteRow = remoteByPersonId.get(canonicalRow.person_id);

    if (!remoteRow) {
      continue;
    }

    if (
      remoteRow.secret_id !== canonicalRow.secret_id ||
      remoteRow.secret_path_token !== canonicalRow.secret_path_token
    ) {
      tokenChanges += 1;
    }
  }

  return tokenChanges;
}

function buildApplySql(canonicalPeopleRows) {
  const values = canonicalPeopleRows.map((row) =>
    [
      escapeSqlValue(row.person_id),
      escapeSqlValue(row.display_name),
      escapeSqlValue(row.role),
      escapeSqlValue(row.secret_id),
      escapeSqlValue(row.secret_path_token)
    ].join(", ")
  );

  return [
    "DELETE FROM scan_records;",
    "DELETE FROM people;",
    "",
    "INSERT INTO people (person_id, display_name, role, secret_id, secret_path_token) VALUES",
    `${values.map((value) => `  (${value})`).join(",\n")};`,
    ""
  ].join("\n");
}

async function writeTableBackupArtifact({ outputPath, table, query, rows, createdAt }) {
  const payload = {
    table,
    query,
    row_count: rows.length,
    created_at: createdAt,
    rows
  };

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, OUTPUT_ENCODING);
}

function extractSingleStatementResults(parsedJson) {
  if (!Array.isArray(parsedJson) || parsedJson.length === 0) {
    throw new Error("Expected Wrangler --json output array.");
  }

  const [firstResult] = parsedJson;

  if (!firstResult || !Array.isArray(firstResult.results)) {
    throw new Error("Expected Wrangler JSON result with a results array.");
  }

  return firstResult.results;
}

function parseWranglerJsonOutput(stdout) {
  const trimmed = stdout.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = stdout.split(/\r?\n/);
    const firstJsonLineIndex = lines.findIndex((line) => {
      const normalizedLine = line.trimStart();
      return normalizedLine.startsWith("[") || normalizedLine.startsWith("{");
    });

    if (firstJsonLineIndex === -1) {
      throw new Error("Wrangler --json command did not emit JSON output.");
    }

    return JSON.parse(lines.slice(firstJsonLineIndex).join("\n"));
  }
}

async function loadD1Config(cwd) {
  const configPath = path.resolve(cwd, WRANGLER_CONFIG_PATH);
  const rawConfig = await readFile(configPath, OUTPUT_ENCODING);
  const parsedConfig = JSON.parse(stripJsonComments(rawConfig));
  const [databaseConfig] = Array.isArray(parsedConfig.d1_databases) ? parsedConfig.d1_databases : [];

  if (!databaseConfig || typeof databaseConfig !== "object") {
    throw new Error(`Unable to resolve d1_databases[0] from ${WRANGLER_CONFIG_PATH}.`);
  }

  if (typeof databaseConfig.binding !== "string" || typeof databaseConfig.database_name !== "string") {
    throw new Error(`Invalid D1 database configuration in ${WRANGLER_CONFIG_PATH}.`);
  }

  return {
    configPath,
    binding: databaseConfig.binding,
    database_name: databaseConfig.database_name
  };
}

async function defaultRunCommand(args, cwd) {
  const { stdout, stderr } = await execFile(process.execPath, [WRANGLER_BIN_PATH, ...args], {
    cwd,
    windowsHide: true,
    encoding: OUTPUT_ENCODING,
    maxBuffer: 10 * 1024 * 1024
  });

  let parsedJson;

  if (args.includes("--json") && stdout.trim()) {
    parsedJson = parseWranglerJsonOutput(stdout);
  }

  return { stdout, stderr, parsedJson };
}

async function executeLoggedCommand(commandLog, args, dependencies) {
  const startedAt = dependencies.now();
  const result = await dependencies.runCommand(args);
  const completedAt = dependencies.now();
  const entry = {
    args,
    started_at: startedAt,
    completed_at: completedAt,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };

  if (result.parsedJson !== undefined) {
    entry.parsed_json = result.parsedJson;
  }

  commandLog.push(entry);
  return result;
}

async function runRemoteApply({ options, outputPath, artifactBase, canonicalRoster, commandLog, dependencies }) {
  if (!options.backupRemote) {
    throw new Error("--apply-remote requires --backup-remote so remote data is backed up before destructive changes.");
  }

  const d1Config = await loadD1Config(dependencies.cwd);
  const canonicalPeopleRows = toDatabasePeopleRows(canonicalRoster.selectedRows);
  const wranglerBaseArgs = ["--remote", "--config", path.relative(dependencies.cwd, d1Config.configPath) || WRANGLER_CONFIG_PATH];
  const remoteApply = {
    changed: false,
    backups: {
      people: null,
      scan_records: null
    },
    pre_apply_counts: {
      people: 0,
      scan_records: 0
    },
    post_apply_counts_by_role: {},
    net_changes: {
      deleted_people: 0,
      deleted_scan_records: 0,
      inserted_people: 0,
      token_changes: 0
    },
    rerun_summary: {
      already_canonical: false,
      skipped_apply: false
    }
  };

  const schemaResult = await executeLoggedCommand(commandLog, [
    "d1",
    "execute",
    d1Config.database_name,
    ...wranglerBaseArgs,
    "--json",
    "--command",
    "SELECT name, type FROM sqlite_master WHERE type = 'table' AND name IN ('people', 'scan_records') ORDER BY name;"
  ], dependencies);
  const schemaRows = extractSingleStatementResults(schemaResult.parsedJson);
  const schemaTables = new Set(schemaRows.map((row) => row.name));

  if (!schemaTables.has("people") || !schemaTables.has("scan_records")) {
    throw new Error(`Remote D1 database ${d1Config.database_name} is missing required tables.`);
  }

  const remotePeopleResult = await executeLoggedCommand(commandLog, [
    "d1",
    "execute",
    d1Config.database_name,
    ...wranglerBaseArgs,
    "--json",
    "--command",
    "SELECT person_id, display_name, role, secret_id, secret_path_token FROM people ORDER BY person_id;"
  ], dependencies);
  const remotePeopleRows = sortPeopleRows(extractSingleStatementResults(remotePeopleResult.parsedJson));

  const prePeopleCountResult = await executeLoggedCommand(commandLog, [
    "d1",
    "execute",
    d1Config.database_name,
    ...wranglerBaseArgs,
    "--json",
    "--command",
    "SELECT COUNT(*) AS people_count FROM people;"
  ], dependencies);
  const [{ people_count: peopleCount = 0 } = {}] = extractSingleStatementResults(prePeopleCountResult.parsedJson);

  const preScanCountResult = await executeLoggedCommand(commandLog, [
    "d1",
    "execute",
    d1Config.database_name,
    ...wranglerBaseArgs,
    "--json",
    "--command",
    "SELECT COUNT(*) AS scan_records_count FROM scan_records;"
  ], dependencies);
  const [{ scan_records_count: scanRecordsCount = 0 } = {}] = extractSingleStatementResults(preScanCountResult.parsedJson);

  remoteApply.pre_apply_counts.people = Number(peopleCount);
  remoteApply.pre_apply_counts.scan_records = Number(scanRecordsCount);
  remoteApply.net_changes.token_changes = countTokenChanges(canonicalPeopleRows, remotePeopleRows);

  const alreadyCanonical = isSamePeopleRoster(canonicalPeopleRows, remotePeopleRows);

  if (alreadyCanonical && Number(scanRecordsCount) === 0) {
    remoteApply.rerun_summary.already_canonical = true;
    remoteApply.rerun_summary.skipped_apply = true;

    return {
      ...artifactBase,
      mode: "apply-remote",
      d1: {
        binding: d1Config.binding,
        database_name: d1Config.database_name,
        config_path: path.relative(dependencies.cwd, d1Config.configPath) || WRANGLER_CONFIG_PATH
      },
      remote_apply: remoteApply,
      commands: commandLog
    };
  }

  const backupDirectory = path.join(path.dirname(outputPath), `${path.basename(outputPath, path.extname(outputPath))}-remote-backups`);
  await mkdir(backupDirectory, { recursive: true });

  const peopleBackupPath = path.join(backupDirectory, "people-pre-apply.json");
  const scanRecordsBackupPath = path.join(backupDirectory, "scan-records-pre-apply.json");
  const scanRecordsBackupQuery = "SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at FROM scan_records ORDER BY event_date, scanned_at, scan_id;";

  const scanRecordsBackupResult = await executeLoggedCommand(commandLog, [
    "d1",
    "execute",
    d1Config.database_name,
    ...wranglerBaseArgs,
    "--json",
    "--command",
    scanRecordsBackupQuery
  ], dependencies);
  const remoteScanRecordRows = extractSingleStatementResults(scanRecordsBackupResult.parsedJson);

  await writeTableBackupArtifact({
    outputPath: peopleBackupPath,
    table: "people",
    query: "SELECT person_id, display_name, role, secret_id, secret_path_token FROM people ORDER BY person_id;",
    rows: remotePeopleRows,
    createdAt: dependencies.now()
  });
  await writeTableBackupArtifact({
    outputPath: scanRecordsBackupPath,
    table: "scan_records",
    query: scanRecordsBackupQuery,
    rows: remoteScanRecordRows,
    createdAt: dependencies.now()
  });

  const applySqlPath = path.join(backupDirectory, "apply-remote.sql");
  await writeFile(applySqlPath, buildApplySql(canonicalPeopleRows), OUTPUT_ENCODING);

  await executeLoggedCommand(commandLog, [
    "d1",
    "execute",
    d1Config.database_name,
    ...wranglerBaseArgs,
    "--json",
    "--file",
    applySqlPath
  ], dependencies);

  const postCountsByRoleResult = await executeLoggedCommand(commandLog, [
    "d1",
    "execute",
    d1Config.database_name,
    ...wranglerBaseArgs,
    "--json",
    "--command",
    "SELECT role, COUNT(*) AS count FROM people GROUP BY role ORDER BY role;"
  ], dependencies);
  const postCountsByRoleRows = extractSingleStatementResults(postCountsByRoleResult.parsedJson);
  const postScanCountResult = await executeLoggedCommand(commandLog, [
    "d1",
    "execute",
    d1Config.database_name,
    ...wranglerBaseArgs,
    "--json",
    "--command",
    "SELECT COUNT(*) AS count FROM scan_records;"
  ], dependencies);
  const [{ count: postApplyScanRecordsCount = 0 } = {}] = extractSingleStatementResults(postScanCountResult.parsedJson);

  remoteApply.changed = true;
  remoteApply.backups.people = peopleBackupPath;
  remoteApply.backups.scan_records = scanRecordsBackupPath;
  remoteApply.net_changes.deleted_people = Number(peopleCount);
  remoteApply.net_changes.deleted_scan_records = Number(scanRecordsCount);
  remoteApply.net_changes.inserted_people = canonicalPeopleRows.length;
  remoteApply.post_apply_counts_by_role = Object.fromEntries(
    postCountsByRoleRows.map((row) => [row.role, Number(row.count)])
  );
  remoteApply.post_apply_scan_records_count = Number(postApplyScanRecordsCount);

  return {
    ...artifactBase,
    mode: "apply-remote",
    d1: {
      binding: d1Config.binding,
      database_name: d1Config.database_name,
      config_path: path.relative(dependencies.cwd, d1Config.configPath) || WRANGLER_CONFIG_PATH
    },
    remote_apply: remoteApply,
    commands: commandLog
  };
}

function serializeRoundTripCsv(rows, canonicalRoster) {
  const selectedRowsByNumber = new Map(canonicalRoster.selectedRows.map((row) => [row.rowNumber, row]));
  const skippedRowsByNumber = new Map(canonicalRoster.skippedRows.map((row) => [row.rowNumber, row]));
  const header = [
    "Name",
    "Role",
    "Selected",
    "Status",
    "Person ID",
    "Secret ID",
    "Secret Token",
    "Secret Link",
    "Selection Order"
  ].join(",");

  const lines = rows.map((row) => {
    const selectedRow = selectedRowsByNumber.get(row.rowNumber);

    if (selectedRow) {
      return [
        row.csvName,
        row.csvRole,
        "YES",
        "selected",
        selectedRow.person_id,
        selectedRow.secret_id,
        selectedRow.secret_path_token,
        selectedRow.production_link,
        String(selectedRow.selection_order)
      ]
        .map(escapeCsvValue)
        .join(",");
    }

    const skippedRow = skippedRowsByNumber.get(row.rowNumber);

    if (skippedRow) {
      return [
        row.csvName,
        row.csvRole,
        "NO",
        skippedRow.reason,
        "",
        "",
        "",
        "",
        ""
      ]
        .map(escapeCsvValue)
        .join(",");
    }

    throw new Error(`Row ${row.rowNumber}: unable to resolve canonical CSV output.`);
  });

  return [header, ...lines].join("\n");
}

export function parseCliArgs(argv) {
  const options = {
    csv: null,
    baseUrl: null,
    output: null,
    dryRun: false,
    writeCsv: false,
    backupRemote: false,
    applyRemote: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--csv":
        options.csv = argv[index + 1] ?? null;
        index += 1;
        break;
      case "--base-url":
        options.baseUrl = argv[index + 1] ?? null;
        index += 1;
        break;
      case "--output":
        options.output = argv[index + 1] ?? null;
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--write-csv":
        options.writeCsv = true;
        break;
      case "--backup-remote":
        options.backupRemote = true;
        break;
      case "--apply-remote":
        options.applyRemote = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.csv) {
    throw new Error("Missing required argument: --csv <path>");
  }

  if (!options.baseUrl) {
    throw new Error("Missing required argument: --base-url <url>");
  }

  if (!options.output) {
    throw new Error("Missing required argument: --output <path>");
  }

  if (!options.dryRun && !options.applyRemote) {
    throw new Error("Choose exactly one mode: --dry-run or --apply-remote.");
  }

  if (options.dryRun && options.applyRemote) {
    throw new Error("Choose exactly one mode: --dry-run or --apply-remote.");
  }

  if (options.backupRemote && !options.applyRemote) {
    throw new Error("--backup-remote is only supported together with --apply-remote.");
  }

  return options;
}

export function parseUserCsv(csvText) {
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: false
  });

  return records.map((record, index) => {
    const rawName = typeof record.Name === "string" ? record.Name : "";
    const rawRole = typeof record.Role === "string" ? record.Role : "";
    const displayName = rawName.trim();
    const normalizedName = normalizeDisplayName(rawName);
    const normalizedRole = normalizeRole(rawRole);

    if (!displayName) {
      throw new Error(`Row ${index + 2}: Name is required.`);
    }

    if (!normalizedRole) {
      throw new Error(`Row ${index + 2}: Role is required.`);
    }

    if (!ALLOWED_ROLES.has(normalizedRole)) {
      throw new Error(`Row ${index + 2}: Unsupported role ${JSON.stringify(rawRole)}.`);
    }

    return {
      rowNumber: index + 2,
      csvName: rawName,
      csvRole: rawRole,
      display_name: displayName,
      role: normalizedRole,
      normalized_name: normalizedName,
      normalized_key: `${normalizedRole}::${normalizedName.toLowerCase()}`
    };
  });
}

export function buildCanonicalRoster(rows, baseUrl) {
  const seenKeys = new Map();
  const slugCountsByRole = new Map();
  const selectedCountsByRole = new Map([
    ["student", 0],
    ["mentor", 0]
  ]);
  const selectedRows = [];
  const skippedRows = [];

  for (const row of rows) {
    const duplicateOfRow = seenKeys.get(row.normalized_key);

    if (duplicateOfRow) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        display_name: row.display_name,
        role: row.role,
        normalized_name: row.normalized_name,
        status: "skipped",
        reason: "duplicate",
        duplicate_of_row: duplicateOfRow
      });
      continue;
    }

    seenKeys.set(row.normalized_key, row.rowNumber);

    const selectedCount = selectedCountsByRole.get(row.role) ?? 0;

    if (selectedCount >= ROLE_LIMIT) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        display_name: row.display_name,
        role: row.role,
        normalized_name: row.normalized_name,
        status: "skipped",
        reason: row.role === "student" ? "over-quota-student" : "over-quota-mentor"
      });
      continue;
    }

    const baseSlug = slugifyName(row.normalized_name);
    const roleSlugCounts = slugCountsByRole.get(row.role) ?? new Map();
    const nextSlugCount = (roleSlugCounts.get(baseSlug) ?? 0) + 1;
    roleSlugCounts.set(baseSlug, nextSlugCount);
    slugCountsByRole.set(row.role, roleSlugCounts);

    const slug = nextSlugCount === 1 ? baseSlug : `${baseSlug}-${nextSlugCount}`;
    const identity = createPersonIdentity(row.role, slug);
    const selectionOrder = selectedRows.length + 1;

    selectedRows.push({
      rowNumber: row.rowNumber,
      selection_order: selectionOrder,
      display_name: row.display_name,
      role: row.role,
      normalized_name: row.normalized_name,
      slug,
      base_slug: baseSlug,
      slug_collision_index: nextSlugCount,
      ...identity,
      production_link: buildProductionLink(baseUrl, row.role, identity.secret_path_token)
    });

    selectedCountsByRole.set(row.role, selectedCount + 1);
  }

  return {
    selectedRows,
    skippedRows,
    summary: {
      total_rows: rows.length,
      selected_total: selectedRows.length,
      skipped_total: skippedRows.length,
      selected_students: selectedRows.filter((row) => row.role === "student").length,
      selected_mentors: selectedRows.filter((row) => row.role === "mentor").length,
      skipped_duplicates: skippedRows.filter((row) => row.reason === "duplicate").length,
      skipped_over_quota_students: skippedRows.filter((row) => row.reason === "over-quota-student").length,
      skipped_over_quota_mentors: skippedRows.filter((row) => row.reason === "over-quota-mentor").length
    }
  };
}

export function buildArtifact({ csvPath, baseUrl, rows, canonicalRoster = null }) {
  const resolvedRoster = canonicalRoster ?? buildCanonicalRoster(rows, baseUrl);

  return {
    contract_version: 1,
    mode: "dry-run",
    source_csv: csvPath,
    base_url: new URL(baseUrl).toString(),
    role_limit: ROLE_LIMIT,
    selected_rows: resolvedRoster.selectedRows,
    skipped_rows: resolvedRoster.skippedRows,
    summary: resolvedRoster.summary
  };
}

export async function runImportUsers(options, dependencies = {}) {
  const csvPath = path.resolve(options.csv);
  const outputPath = path.resolve(options.output);
  const csvText = await readFile(csvPath, OUTPUT_ENCODING);
  const rows = parseUserCsv(csvText);
  const canonicalRoster = buildCanonicalRoster(rows, options.baseUrl);
  const artifactBase = buildArtifact({
    csvPath: options.csv,
    baseUrl: options.baseUrl,
    rows,
    canonicalRoster
  });
  const roundTripCsv = options.writeCsv ? serializeRoundTripCsv(rows, canonicalRoster) : null;
  const commandLog = [];
  const resolvedDependencies = {
    cwd: dependencies.cwd ? path.resolve(dependencies.cwd) : process.cwd(),
    now: dependencies.now ?? (() => new Date().toISOString()),
    runCommand: dependencies.runCommand ?? ((args) => defaultRunCommand(args, dependencies.cwd ? path.resolve(dependencies.cwd) : process.cwd()))
  };

  const artifact = options.applyRemote
    ? await runRemoteApply({
      options,
      outputPath,
      artifactBase,
      canonicalRoster,
      commandLog,
      dependencies: resolvedDependencies
    })
    : artifactBase;
  const artifactJson = `${JSON.stringify(artifact, null, 2)}\n`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, artifactJson, OUTPUT_ENCODING);

  if (roundTripCsv !== null) {
    await writeFile(csvPath, roundTripCsv, OUTPUT_ENCODING);
  }

  return { artifact, outputPath, artifactJson };
}

async function main() {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    const { artifact } = await runImportUsers(options);

    process.stdout.write(
      `${JSON.stringify({
        output: options.output,
        selectedStudents: artifact.summary.selected_students,
        selectedMentors: artifact.summary.selected_mentors,
        skippedRows: artifact.summary.skipped_total
      })}\n`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
