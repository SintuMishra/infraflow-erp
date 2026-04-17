const app = require("./app");
const env = require("./config/env");
const { connectDB } = require("./config/db");
const logger = require("./utils/logger");
const { verifyCompanyScopeFoundation } = require("./utils/companyScope.util");

const startServer = async () => {
  try {
    await connectDB();
    if (env.enforceCompanyScope) {
      await verifyCompanyScopeFoundation();
    }

    app.listen(env.port, () => {
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

startServer();
