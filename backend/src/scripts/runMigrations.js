const fs = require("node:fs/promises");
const path = require("node:path");

const { pool } = require("../config/db");

const MIGRATIONS_DIR = path.resolve(__dirname, "../../db/migrations");

const formatMigrationError = (error) => {
  if (!error) {
    return "Unknown migration error";
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors
      .map((item) => item?.message || String(item))
      .join(" | ");
  }

  return error.message || String(error);
};

const ensureMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const listMigrationFiles = async () => {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

const getAppliedMigrations = async (client) => {
  const result = await client.query(
    "SELECT filename FROM schema_migrations ORDER BY filename ASC"
  );

  return new Set(result.rows.map((row) => row.filename));
};

const applyMigration = async (client, filename) => {
  const sql = await fs.readFile(path.join(MIGRATIONS_DIR, filename), "utf8");

  await client.query("BEGIN");

  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1)",
      [filename]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};

const runMigrations = async () => {
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);

    const [migrationFiles, appliedMigrations] = await Promise.all([
      listMigrationFiles(),
      getAppliedMigrations(client),
    ]);

    const pendingMigrations = migrationFiles.filter(
      (filename) => !appliedMigrations.has(filename)
    );

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations.");
      return;
    }

    for (const filename of pendingMigrations) {
      console.log(`Applying migration: ${filename}`);
      await applyMigration(client, filename);
    }

    console.log(`Applied ${pendingMigrations.length} migration(s) successfully.`);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations().catch((error) => {
  console.error(`Migration failed: ${formatMigrationError(error)}`);
  process.exitCode = 1;
});
