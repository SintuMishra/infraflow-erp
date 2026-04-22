const http = require("node:http");
const { URL } = require("node:url");

const port = Number(process.env.PASSWORD_RESET_WEBHOOK_SANDBOX_PORT || 5055);
const host = process.env.PASSWORD_RESET_WEBHOOK_SANDBOX_HOST || "127.0.0.1";
const route = process.env.PASSWORD_RESET_WEBHOOK_SANDBOX_ROUTE || "/password-reset";

let lastEvent = null;

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "content-type": "application/json",
  });
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req) =>
  await new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
  const pathname = parsedUrl.pathname;

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, {
      success: true,
      service: "password-reset-webhook-sandbox",
    });
    return;
  }

  if (req.method === "GET" && pathname === "/last") {
    sendJson(res, 200, {
      success: true,
      data: lastEvent,
    });
    return;
  }

  if (req.method === "POST" && pathname === route) {
    try {
      const payload = await readJsonBody(req);
      const channels = Array.isArray(payload.deliveryChannels)
        ? payload.deliveryChannels
        : [];

      const channelStatuses = channels.reduce((acc, channel) => {
        const targetValue =
          channel === "mobile"
            ? String(payload.mobileNumber || "").trim()
            : channel === "email"
            ? String(payload.email || "").trim()
            : "";
        const accepted = Boolean(targetValue);
        acc[channel] = {
          accepted,
          reason: accepted ? null : "Recipient value missing",
        };
        return acc;
      }, {});

      const accepted = Object.values(channelStatuses).some((status) => status.accepted);

      lastEvent = {
        receivedAt: new Date().toISOString(),
        username: payload.username || null,
        employeeCode: payload.employeeCode || null,
        fullName: payload.fullName || null,
        mobileNumber: payload.mobileNumber || null,
        companyId: payload.companyId || null,
        resetOtp: payload.resetOtp || null,
        resetUrl: payload.resetUrl || null,
        expiresAt: payload.expiresAt || null,
        requestedChannels: payload.requestedChannels || [],
        deliveryChannels: channels,
      };

      if (lastEvent.mobileNumber && lastEvent.resetOtp) {
        console.log(
          `[OTP-SANDBOX] mobile=${lastEvent.mobileNumber} otp=${lastEvent.resetOtp} companyId=${lastEvent.companyId || "-"}`
        );
      } else {
        console.log("[OTP-SANDBOX] received reset event", lastEvent);
      }

      sendJson(res, 200, {
        accepted,
        reason: accepted ? null : "No valid delivery targets found",
        channels: channelStatuses,
      });
    } catch (error) {
      sendJson(res, 400, {
        accepted: false,
        reason: error.message || "Invalid webhook payload",
        channels: {},
      });
    }
    return;
  }

  sendJson(res, 404, {
    success: false,
    message: "Not found",
  });
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify(
      {
        success: true,
        message: "Password reset webhook sandbox started",
        endpoint: `http://${host}:${port}${route}`,
        health: `http://${host}:${port}/health`,
        lastEvent: `http://${host}:${port}/last`,
      },
      null,
      2
    )
  );
});
