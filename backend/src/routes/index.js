const express = require("express");
const authRoutes = require("../modules/auth");
const employeesRoutes = require("../modules/employees");
const crusherRoutes = require("../modules/crusher");
const projectsRoutes = require("../modules/projects");
const dispatchRoutes = require("../modules/dispatch");
const dashboardRoutes = require("../modules/dashboard");
const vehiclesRoutes = require("../modules/vehicles");
const mastersRoutes = require("../modules/masters");
const vendorsRoutes = require("../modules/vendors");
const plantsRoutes = require("../modules/plants");
const transportRatesRoutes = require("../modules/transport_rates");
const partyMaterialRates = require("../modules/party_material_rates");
const companyProfileRoutes = require("../modules/company_profile");
const partiesRoutes = require("../modules/parties");
const auditLogsRoutes = require("../modules/audit_logs");
const partyOrdersRoutes = require("../modules/party_orders");
const onboardingRoutes = require("../modules/onboarding");
const { checkDbHealth } = require("../config/db");

const router = express.Router();

router.get("/health", async (req, res, next) => {
  try {
    const db = await checkDbHealth();

    res.json({
      success: true,
      message: "API health is good",
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        api: "ok",
        database: db.ok ? "ok" : "degraded",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/ready", async (req, res, next) => {
  try {
    await checkDbHealth();

    res.json({
      success: true,
      message: "API is ready to serve requests",
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    error.statusCode = 503;
    next(error);
  }
});

router.use("/auth", authRoutes);
router.use("/employees", employeesRoutes);
router.use("/crusher-reports", crusherRoutes);
router.use("/plant-unit-reports", crusherRoutes);
router.use("/project-reports", projectsRoutes);
router.use("/dispatch-reports", dispatchRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/vehicles", vehiclesRoutes);
router.use("/masters", mastersRoutes);
router.use("/vendors", vendorsRoutes);
router.use("/plants", plantsRoutes);
router.use("/transport-rates", transportRatesRoutes);
router.use("/party-material-rates", partyMaterialRates);
router.use("/company-profile", companyProfileRoutes);
router.use("/parties", partiesRoutes);
router.use("/party-orders", partyOrdersRoutes);
router.use("/audit-logs", auditLogsRoutes);
router.use("/onboarding", onboardingRoutes);

module.exports = router;
