const env = require("../config/env");

const levelPriority = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const activeLevel = levelPriority[env.logLevel] ?? levelPriority.info;

const writeLog = (level, message, meta = {}) => {
  if ((levelPriority[level] ?? levelPriority.info) > activeLevel) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (meta && Object.keys(meta).length > 0) {
    payload.meta = meta;
  }

  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
};

module.exports = {
  error: (message, meta) => writeLog("error", message, meta),
  warn: (message, meta) => writeLog("warn", message, meta),
  info: (message, meta) => writeLog("info", message, meta),
  debug: (message, meta) => writeLog("debug", message, meta),
};
