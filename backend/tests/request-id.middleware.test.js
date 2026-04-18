const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedAppLogger = async (loggerMock, run) => {
  const appPath = require.resolve("../src/app");
  const loggerPath = require.resolve("../src/utils/logger");

  const originalApp = require.cache[appPath];
  const originalLogger = require.cache[loggerPath];

  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: loggerMock,
  };

  delete require.cache[appPath];

  try {
    const app = require(appPath);
    await run(app);
  } finally {
    delete require.cache[appPath];

    if (originalApp) {
      require.cache[appPath] = originalApp;
    }

    if (originalLogger) {
      require.cache[loggerPath] = originalLogger;
    } else {
      delete require.cache[loggerPath];
    }
  }
};

const createMockResponse = () => {
  const emitter = new EventEmitter();
  const headers = new Map();

  return {
    statusCode: 200,
    headersSent: false,
    on: (...args) => emitter.on(...args),
    emit: (...args) => emitter.emit(...args),
    setHeader: (name, value) => headers.set(String(name).toLowerCase(), value),
    getHeader: (name) => headers.get(String(name).toLowerCase()),
    end() {
      this.headersSent = true;
      emitter.emit("finish");
      emitter.emit("close");
    },
  };
};

test(
  "request middleware sets X-Request-Id and includes it in HTTP request logs",
  { concurrency: false },
  async () => {
    const capturedInfo = [];

    await withMockedAppLogger(
      {
        info: (message, meta) => {
          capturedInfo.push({ message, meta });
        },
        warn: () => null,
        error: () => null,
        debug: () => null,
      },
      async (app) => {
        const requestIdLayer = app.router.stack.find(
          (layer) =>
            typeof layer.handle === "function" &&
            String(layer.handle).includes("X-Request-Id")
        );
        const loggerLayer = app.router.stack.find((layer) => layer.name === "logger");

        assert.ok(requestIdLayer, "expected request-id middleware to be registered");
        assert.ok(loggerLayer, "expected morgan logger middleware to be registered");

        const req = {
          method: "GET",
          url: "/",
          originalUrl: "/",
          headers: {},
          httpVersionMajor: 1,
          httpVersionMinor: 1,
          socket: {
            remoteAddress: "127.0.0.1",
          },
        };
        const res = createMockResponse();

        requestIdLayer.handle(req, res, () => null);
        const requestId = res.getHeader("x-request-id");
        assert.ok(requestId, "expected x-request-id response header");

        loggerLayer.handle(req, res, () => null);
        res.end();
        await new Promise((resolve) => setImmediate(resolve));

        const requestLog = capturedInfo.find(
          (entry) =>
            entry.message === "HTTP request" &&
            String(entry.meta?.line || "").includes(`req_id=${requestId}`)
        );

        assert.ok(
          requestLog,
          "expected HTTP request log entry to include the same request id"
        );
      }
    );
  }
);
