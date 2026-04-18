const { Client } = require("pg");

const WAIT_MS = Number(process.env.FINANCE_TEST_DB_WAIT_MS || 60000);
const RETRY_MS = Number(process.env.FINANCE_TEST_DB_RETRY_MS || 1500);

const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 55432),
  database: process.env.DB_NAME || "construction_erp_finance_test",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDb = async () => {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt <= WAIT_MS) {
    const client = new Client(config);
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("Finance test DB is reachable.");
      return;
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch (_ignored) {
        // no-op
      }
      await sleep(RETRY_MS);
    }
  }

  const details = lastError ? `${lastError.code || "unknown"} ${lastError.message}` : "timeout";
  throw new Error(`Finance test DB did not become reachable: ${details}`);
};

waitForDb().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
