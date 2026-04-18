const app = require("./app");
const env = require("./config/env");
const { closePool, connectDB } = require("./config/db");
const logger = require("./utils/logger");
const { verifyCompanyScopeFoundation } = require("./utils/companyScope.util");

let httpServer = null;
let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info("Shutdown initiated", { signal });

  try {
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  } catch (error) {
    logger.error("HTTP server close failed", {
      message: error?.message || "unknown",
    });
  }

  try {
    await closePool();
  } catch (error) {
    logger.error("Database pool close failed", {
      message: error?.message || "unknown",
    });
  }

  process.exit(0);
};

const startServer = async () => {
  try {
    await connectDB();
    if (env.enforceCompanyScope) {
      await verifyCompanyScopeFoundation();
    }

    httpServer = app.listen(env.port, () => {
      logger.info("Server started", {
        port: env.port,
        environment: env.nodeEnv,
      });
    });
  } catch (error) {
    logger.error("Server failed to start", {
      message: error.message,
    });
    process.exit(1);
  }
};

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    message: reason?.message || String(reason),
  });
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    message: error?.message || "unknown",
  });
  shutdown("uncaughtException");
});

startServer();
