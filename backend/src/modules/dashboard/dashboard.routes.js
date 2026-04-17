const express = require("express");
const {
  dashboardSummary,
  dashboardCommercialExceptions,
  reviewCommercialExceptionController,
  assignCommercialExceptionController,
} = require("./dashboard.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.get(
  "/summary",
  authenticate,
  dashboardSummary
);

router.get(
  "/commercial-exceptions",
  authenticate,
  dashboardCommercialExceptions
);

router.post(
  "/commercial-exceptions/review",
  authenticate,
  reviewCommercialExceptionController
);

router.post(
  "/commercial-exceptions/assign",
  authenticate,
  assignCommercialExceptionController
);

module.exports = router;
