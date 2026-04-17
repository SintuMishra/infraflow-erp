const logger = require("./logger");

const sendControllerError = (req, res, error, fallbackMessage) => {
  const statusCode = error?.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  logger.error("Request failed in controller", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: error?.message,
  });

  return res.status(statusCode).json({
    success: false,
    message:
      isClientError && error?.message ? error.message : fallbackMessage,
    requestId: req.requestId,
  });
};

module.exports = {
  sendControllerError,
};
