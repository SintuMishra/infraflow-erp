const { Pool } = require("pg");
const env = require("./env");
const logger = require("../utils/logger");

const pool = new Pool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  max: env.dbPoolMax,
  min: env.dbPoolMin,
  idleTimeoutMillis: env.dbPoolIdleTimeoutMs,
  connectionTimeoutMillis: env.dbPoolConnectionTimeoutMs,
});

const connectDB = async () => {
  try {
    const client = await pool.connect();
    logger.info("Database connected successfully", {
      host: env.dbHost,
      database: env.dbName,
    });
    client.release();
  } catch (error) {
    logger.error("Database connection failed", {
      message: error.message,
    });
    process.exit(1);
  }
};

const checkDbHealth = async () => {
  await pool.query("SELECT 1");

  return {
    ok: true,
  };
};

const withTransaction = async (work) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const closePool = async () => {
  await pool.end();
};

module.exports = {
  pool,
  connectDB,
  checkDbHealth,
  closePool,
  withTransaction,
};
