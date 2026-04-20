const env = require("../config/env");

const buildPublicResetUrl = (resetOtp) => {
  const baseUrl = String(env.passwordResetPublicResetBaseUrl || "").trim();
  if (!baseUrl) {
    return null;
  }

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(resetOtp)}`;
};

const toTruthy = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const defaultChannelStatusMap = (channels, accepted, reason = null) =>
  channels.reduce((acc, channel) => {
    acc[channel] = {
      accepted: Boolean(accepted),
      reason,
    };
    return acc;
  }, {});

const normalizeChannelStatusMap = (rawChannels, fallbackChannels = []) => {
  if (!rawChannels || typeof rawChannels !== "object" || Array.isArray(rawChannels)) {
    return defaultChannelStatusMap(fallbackChannels, true, null);
  }

  return fallbackChannels.reduce((acc, channel) => {
    const rawValue = rawChannels[channel];

    if (rawValue === undefined || rawValue === null) {
      acc[channel] = {
        accepted: false,
        reason: "No channel status returned by delivery webhook",
      };
      return acc;
    }

    if (typeof rawValue === "object" && !Array.isArray(rawValue)) {
      acc[channel] = {
        accepted: toTruthy(rawValue.accepted),
        reason: rawValue.reason || null,
      };
      return acc;
    }

    acc[channel] = {
      accepted: toTruthy(rawValue),
      reason: null,
    };
    return acc;
  }, {});
};

const evaluateDeliveryAccepted = (channelStatusMap, policy) => {
  const statuses = Object.values(channelStatusMap || {});

  if (!statuses.length) {
    return false;
  }

  if (policy === "all") {
    return statuses.every((status) => Boolean(status?.accepted));
  }

  return statuses.some((status) => Boolean(status?.accepted));
};

const sendPasswordResetWebhook = async ({
  resetOtp,
  expiresAt,
  user,
  companyId,
}) => {
  const webhookUrl = String(env.passwordResetWebhookUrl || "").trim();
  if (!webhookUrl) {
      return {
        mode: "webhook",
        accepted: false,
        reason: "PASSWORD_RESET_WEBHOOK_URL is not configured",
        channelStatuses: {},
        deliveryChannels: [],
        deliveryPolicy: env.passwordResetDeliverySuccessPolicy,
      };
  }

  const requestedChannels = Array.isArray(env.passwordResetDeliveryChannels)
    ? env.passwordResetDeliveryChannels
    : [];
  const availableTargets = {
    mobile: String(user.mobileNumber || "").trim(),
    email: String(user.email || "").trim().toLowerCase(),
  };
  const deliveryChannels = requestedChannels.filter(
    (channel) => Boolean(availableTargets[channel])
  );

  if (!deliveryChannels.length) {
    return {
      mode: "webhook",
      accepted: false,
      reason: "No eligible password reset delivery targets found for configured channels",
      channelStatuses: defaultChannelStatusMap(
        requestedChannels,
        false,
        "Recipient value missing"
      ),
      deliveryChannels,
      deliveryPolicy: env.passwordResetDeliverySuccessPolicy,
    };
  }

  const timeoutMs = Number(env.passwordResetWebhookTimeoutMs || 5000) || 5000;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      signal: abortController.signal,
      body: JSON.stringify({
        event: "auth.password_reset_requested",
        companyId: user.companyId || companyId || null,
        userId: user.id,
        username: user.username || "",
        employeeCode: user.employeeCode || "",
        fullName: user.fullName || "",
        mobileNumber: availableTargets.mobile || "",
        email: availableTargets.email || "",
        requestedChannels,
        deliveryChannels,
        deliveryPolicy: env.passwordResetDeliverySuccessPolicy,
        resetOtp,
        resetToken: resetOtp,
        resetUrl: buildPublicResetUrl(resetOtp),
        expiresAt: expiresAt.toISOString(),
      }),
    });

    if (!response.ok) {
      return {
        mode: "webhook",
        accepted: false,
        reason: `Delivery webhook failed with status ${response.status}`,
        channelStatuses: defaultChannelStatusMap(
          deliveryChannels,
          false,
          `Delivery webhook failed with status ${response.status}`
        ),
        deliveryChannels,
        deliveryPolicy: env.passwordResetDeliverySuccessPolicy,
      };
    }

    let parsedBody = null;
    try {
      parsedBody = await response.json();
    } catch (_error) {
      parsedBody = null;
    }

    const channelStatuses = normalizeChannelStatusMap(
      parsedBody?.channels,
      deliveryChannels
    );
    const accepted =
      parsedBody?.accepted !== undefined
        ? toTruthy(parsedBody.accepted)
        : evaluateDeliveryAccepted(
            channelStatuses,
            env.passwordResetDeliverySuccessPolicy
          );

    return {
      mode: "webhook",
      accepted,
      reason: parsedBody?.reason || null,
      channelStatuses,
      deliveryChannels,
      deliveryPolicy: env.passwordResetDeliverySuccessPolicy,
    };
  } catch (error) {
    return {
      mode: "webhook",
      accepted: false,
      reason: error?.name === "AbortError" ? "Delivery webhook timed out" : error.message,
      channelStatuses: defaultChannelStatusMap(
        deliveryChannels,
        false,
        error?.name === "AbortError" ? "Delivery webhook timed out" : error.message
      ),
      deliveryChannels,
      deliveryPolicy: env.passwordResetDeliverySuccessPolicy,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const dispatchPasswordResetInstruction = async ({
  resetOtp,
  expiresAt,
  user,
  companyId,
  exposeToken = false,
}) => {
  if (exposeToken || env.passwordResetDeliveryMode === "token_response") {
    return {
      mode: "token_response",
      accepted: true,
      reason: null,
      channelStatuses: {
        in_app: {
          accepted: true,
          reason: null,
        },
      },
      deliveryChannels: ["in_app"],
      deliveryPolicy: "any",
    };
  }

  if (env.passwordResetDeliveryMode === "webhook") {
    return await sendPasswordResetWebhook({
      resetOtp,
      expiresAt,
      user,
      companyId,
    });
  }

  return {
    mode: env.passwordResetDeliveryMode,
    accepted: false,
    reason: "Password reset delivery mode is disabled or not configured for external delivery",
    channelStatuses: {},
    deliveryChannels: [],
    deliveryPolicy: env.passwordResetDeliverySuccessPolicy,
  };
};

module.exports = {
  dispatchPasswordResetInstruction,
};
