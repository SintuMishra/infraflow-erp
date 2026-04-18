const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { randomBytes, randomUUID } = require("node:crypto");

const apiRoutes = require("./routes");
const env = require("./config/env");
const logger = require("./utils/logger");

const app = express();
app.set("trust proxy", env.trustProxyHops);

const corsOptions =
  env.corsOrigin === "*"
    ? {}
    : {
        origin: env.corsOrigin.split(",").map((origin) => origin.trim()),
      };

const generateRequestId = () => {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }

  return `req_${randomBytes(12).toString("hex")}`;
};

morgan.token("request-id", (req, res) => {
  return res.getHeader("X-Request-Id") || req.requestId || "-";
});

const morganFormat =
  env.nodeEnv === "production"
    ? ":method :url :status :res[content-length] - :response-time ms req_id=:request-id"
    : "dev req_id=:request-id";

const morganStream = {
  write: (message) => {
    logger.info("HTTP request", {
      line: message.trim(),
    });
  },
};

app.use(helmet());
app.use(cors(corsOptions));
app.use((req, res, next) => {
  req.requestId = generateRequestId();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});
app.use(morgan(morganFormat, { stream: morganStream }));
// Company profile logo is sent as a base64 data URL, so keep payload limits above default.
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Construction ERP API is running",
    requestId: req.requestId,
  });
});

app.use("/api", apiRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;

  logger.error("Unhandled request error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: error.message,
  });

  return res.status(statusCode).json({
    success: false,
    code: error.code || null,
    message:
      statusCode >= 500
        ? "Unexpected server error"
        : error.message || "Request failed",
    requestId: req.requestId,
  });
});

module.exports = app;
