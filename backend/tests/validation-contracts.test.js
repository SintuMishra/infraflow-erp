const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const {
  ASSIGNABLE_LOGIN_ROLES,
  STRONG_PASSWORD_MESSAGE,
  validateCreateUserInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateRefreshSessionInput,
  validateLogoutSessionInput,
  validateAdminResetPasswordInput,
  validateChangePasswordInput,
} = require("../src/modules/auth/auth.validation");
const {
  validateDispatchReportInput,
  validateDispatchEditInput,
  validateDispatchStatusInput,
} = require("../src/modules/dispatch/dispatch.validation");
const {
  validateCreateVehicleInput,
  validateVehicleStatusUpdate,
} = require("../src/modules/vehicles/vehicles.validation");
const {
  validateCreatePartyInput,
  validatePartyStatusPayload,
} = require("../src/modules/parties/parties.validation");
const {
  validateCreateVendorInput,
  validateVendorStatusPayload,
} = require("../src/modules/vendors/vendors.validation");
const {
  validateCreatePlantInput,
  validatePlantStatusPayload,
} = require("../src/modules/plants/plants.validation");
const {
  validatePartyOrderPayload,
  validatePartyOrderStatusPayload,
} = require("../src/modules/party_orders/party_orders.validation");
const {
  validateCreateRateInput,
  validateRateStatusPayload,
} = require("../src/modules/party_material_rates/party_material_rates.validation");
const {
  validateCompanyProfilePayload,
} = require("../src/modules/company_profile/company_profile.validation");
const {
  validateBootstrapCompanyInput,
} = require("../src/modules/onboarding/onboarding.validation");
const {
  validateProjectReportInput,
} = require("../src/modules/projects/projects.validation");
const {
  validateCrusherReportInput,
} = require("../src/modules/crusher/crusher.validation");
const {
  validateCreateEmployeeInput,
  validateEmployeeUpdateInput,
} = require("../src/modules/employees/employees.validation");

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

const runMiddleware = (middleware, body) => {
  const req = { body };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { req, res, nextCalled };
};

test("dispatch create validation rejects negative invoiceValue", async () => {
  const { res, nextCalled } = runMiddleware(validateDispatchReportInput, {
    dispatchDate: "2026-04-15",
    sourceType: "Plant",
    plantId: 1,
    materialId: 1,
    vehicleId: 1,
    partyId: 1,
    destinationName: "Site A",
    quantityTons: 10,
    invoiceValue: -5,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /invoiceValue/i);
});

test("dispatch create validation rejects non-numeric quantityTons", async () => {
  const { res, nextCalled } = runMiddleware(validateDispatchReportInput, {
    dispatchDate: "2026-04-15",
    sourceType: "Plant",
    plantId: 1,
    materialId: 1,
    vehicleId: 1,
    partyId: 1,
    destinationName: "Site A",
    quantityTons: "abc",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /quantityTons/i);
});

test("dispatch edit validation rejects non-numeric distanceKm", async () => {
  const { res, nextCalled } = runMiddleware(validateDispatchEditInput, {
    dispatchDate: "2026-04-15",
    sourceType: "Plant",
    plantId: 1,
    materialId: 1,
    vehicleId: 1,
    partyId: 1,
    destinationName: "Site A",
    quantityTons: 12.5,
    distanceKm: "far",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /distanceKm/i);
});

test("dispatch edit validation rejects non-numeric otherCharge", async () => {
  const { res, nextCalled } = runMiddleware(validateDispatchEditInput, {
    dispatchDate: "2026-04-15",
    sourceType: "Plant",
    plantId: 1,
    materialId: 1,
    vehicleId: 1,
    partyId: 1,
    destinationName: "Site A",
    quantityTons: 12.5,
    otherCharge: "oops",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /otherCharge/i);
});

test("onboarding bootstrap validation requires company and owner identity", async () => {
  const { res, nextCalled } = runMiddleware(validateBootstrapCompanyInput, {
    companyName: "Apex Build Infra",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /ownerFullName/i);
});

test("onboarding bootstrap validation handles missing request body safely", async () => {
  const { res, nextCalled } = runMiddleware(validateBootstrapCompanyInput, undefined);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /companyName/i);
});

test("onboarding bootstrap validation rejects non-ISO owner joining date", async () => {
  const { res, nextCalled } = runMiddleware(validateBootstrapCompanyInput, {
    companyName: "Apex Build Infra",
    ownerFullName: "Amit Sharma",
    ownerDesignation: "Managing Director",
    ownerJoiningDate: "16/04/2026",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /YYYY-MM-DD/i);
});

test("onboarding bootstrap validation rejects invalid company email", async () => {
  const { res, nextCalled } = runMiddleware(validateBootstrapCompanyInput, {
    companyName: "Apex Build Infra",
    ownerFullName: "Amit Sharma",
    ownerDesignation: "Managing Director",
    companyProfile: {
      email: "bad-email",
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /valid email/i);
});

test("onboarding bootstrap validation rejects invalid owner mobile number", async () => {
  const { res, nextCalled } = runMiddleware(validateBootstrapCompanyInput, {
    companyName: "Apex Build Infra",
    ownerFullName: "Amit Sharma",
    ownerDesignation: "Managing Director",
    ownerMobileNumber: "98ABCD",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /ownerMobileNumber/i);
});

test("onboarding bootstrap validation rejects invalid GSTIN format", async () => {
  const { res, nextCalled } = runMiddleware(validateBootstrapCompanyInput, {
    companyName: "Apex Build Infra",
    ownerFullName: "Amit Sharma",
    ownerDesignation: "Managing Director",
    companyProfile: {
      gstin: "BAD-GSTIN",
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /gstin/i);
});

test("onboarding bootstrap validation rejects invalid PAN format", async () => {
  const { res, nextCalled } = runMiddleware(validateBootstrapCompanyInput, {
    companyName: "Apex Build Infra",
    ownerFullName: "Amit Sharma",
    ownerDesignation: "Managing Director",
    companyProfile: {
      pan: "1234",
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /pan/i);
});

test("project report validation requires plantId for plant-linked reporting", async () => {
  const { res, nextCalled } = runMiddleware(validateProjectReportInput, {
    reportDate: "2026-04-17",
    projectName: "Riverfront Bridge",
    siteName: "Pier Zone 2",
    workDone: "Deck shuttering",
    labourCount: 12,
    machineCount: 2,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /plantId/i);
});

test("project report validation accepts master-style shift names and normalizes them", async () => {
  const payload = {
    reportDate: "2026-04-22",
    plantId: 2,
    projectName: "Riverfront Bridge",
    siteName: "Pier Zone 2",
    workDone: "Foundation casting completed",
    labourCount: 18,
    machineCount: 3,
    shift: "Day Shift",
    reportStatus: "On_Track",
  };
  const { req, res, nextCalled } = runMiddleware(validateProjectReportInput, payload);

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
  assert.equal(req.body.shift, "day_shift");
  assert.equal(req.body.reportStatus, "on_track");
});

test("crusher report validation requires plantId for plant-linked reporting", async () => {
  const { res, nextCalled } = runMiddleware(validateCrusherReportInput, {
    reportDate: "2026-04-17",
    shift: "Morning",
    materialType: "20mm",
    productionTons: 240,
    dispatchTons: 210,
    machineHours: 9,
    dieselUsed: 120,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /plantId/i);
});

test("crusher report validation rejects breakdown hours above machine hours", async () => {
  const { res, nextCalled } = runMiddleware(validateCrusherReportInput, {
    reportDate: "2026-04-17",
    plantId: 2,
    machineHours: 8.5,
    breakdownHours: 9,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /breakdownHours/i);
});

test("crusher report validation rejects fractional operators count", async () => {
  const { res, nextCalled } = runMiddleware(validateCrusherReportInput, {
    reportDate: "2026-04-17",
    plantId: 2,
    operatorsCount: 6.5,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /operatorsCount/i);
});

test("crusher report validation rejects dispatch above opening+production when opening stock provided", async () => {
  const { res, nextCalled } = runMiddleware(validateCrusherReportInput, {
    reportDate: "2026-04-17",
    plantId: 2,
    openingStockTons: 75,
    productionTons: 240,
    dispatchTons: 320,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /dispatchTons/i);
});

test("employee update validation rejects invalid mobile number", async () => {
  const { res, nextCalled } = runMiddleware(validateEmployeeUpdateInput, {
    fullName: "Ravi Kumar",
    mobileNumber: "98ABCD",
    department: "Plant Operations",
    designation: "Supervisor",
    joiningDate: "2026-04-17",
    status: "active",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /mobileNumber/i);
});

test("employee create validation requires fullName and mobileNumber only", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateEmployeeInput, {
    fullName: "Ravi Kumar",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /mobileNumber/i);
});

test("employee create validation allows optional department and designation", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateEmployeeInput, {
    fullName: "Ravi Kumar",
    mobileNumber: "9876543210",
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("employee create validation rejects invalid status when provided", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateEmployeeInput, {
    fullName: "Ravi Kumar",
    mobileNumber: "9876543210",
    status: "on_leave",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Valid status is required/i);
});

test("employee create validation rejects invalid email when provided", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateEmployeeInput, {
    fullName: "Ravi Kumar",
    mobileNumber: "9876543210",
    email: "not-an-email",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /email/i);
});

test("employee update validation rejects invalid emergency contact number", async () => {
  const { res, nextCalled } = runMiddleware(validateEmployeeUpdateInput, {
    fullName: "Ravi Kumar",
    mobileNumber: "9876543210",
    emergencyContactNumber: "12AB56",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /emergencyContactNumber/i);
});

test("employee update validation allows valid editable profile payload", async () => {
  const { res, nextCalled } = runMiddleware(validateEmployeeUpdateInput, {
    fullName: "Ravi Kumar",
    mobileNumber: "9876543210",
    email: "ravi@example.com",
    emergencyContactNumber: "9123456780",
    employmentType: "full_time",
    idProofType: "aadhaar",
    idProofNumber: "1234-5678-9012",
    status: "active",
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("employee create validation allows custom other employment and id proof type", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateEmployeeInput, {
    fullName: "Ravi Kumar",
    mobileNumber: "9876543210",
    employmentType: "other:project consultant",
    idProofType: "other:trade_license",
    status: "active",
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("auth create-user validation rejects protected super admin role", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateUserInput, {
    employeeId: 1,
    role: "super_admin",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /role must be one of/i);
  assert.equal(ASSIGNABLE_LOGIN_ROLES.includes("super_admin"), false);
});

test("dispatch create validation rejects invalid e-way bill number", async () => {
  const { res, nextCalled } = runMiddleware(validateDispatchReportInput, {
    dispatchDate: "2026-04-16",
    sourceType: "Plant",
    plantId: 1,
    materialId: 1,
    vehicleId: 1,
    partyId: 1,
    destinationName: "Project Site",
    quantityTons: 10,
    ewbNumber: "12345",
    ewbDate: "2026-04-16",
    ewbValidUpto: "2026-04-17",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.message,
    "E-Way Bill Number must be a 12-digit numeric value"
  );
});

test("dispatch edit validation rejects e-way validity before issue date", async () => {
  const { res, nextCalled } = runMiddleware(validateDispatchEditInput, {
    dispatchDate: "2026-04-16",
    sourceType: "Plant",
    plantId: 1,
    materialId: 1,
    vehicleId: 1,
    partyId: 1,
    destinationName: "Project Site",
    quantityTons: 10,
    ewbNumber: "123456789012",
    ewbDate: "2026-04-18",
    ewbValidUpto: "2026-04-17",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.message,
    "E-Way Bill validity cannot be before EWB date"
  );
});

test("dispatch validation rejects e-way bill date after dispatch date", async () => {
  const { res, nextCalled } = runMiddleware(validateDispatchReportInput, {
    dispatchDate: "2026-04-16",
    sourceType: "Plant",
    plantId: 1,
    materialId: 1,
    vehicleId: 1,
    partyId: 1,
    destinationName: "Project Site",
    quantityTons: 10,
    ewbNumber: "123456789012",
    ewbDate: "2026-04-17",
    ewbValidUpto: "2026-04-18",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "E-Way Bill Date cannot be after dispatch date");
});

test("dispatch validation rejects e-way bill date before invoice date", async () => {
  const { res, nextCalled } = runMiddleware(validateDispatchReportInput, {
    dispatchDate: "2026-04-16",
    sourceType: "Plant",
    plantId: 1,
    materialId: 1,
    vehicleId: 1,
    partyId: 1,
    destinationName: "Project Site",
    quantityTons: 10,
    invoiceDate: "2026-04-16",
    ewbNumber: "123456789012",
    ewbDate: "2026-04-15",
    ewbValidUpto: "2026-04-17",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "E-Way Bill Date cannot be before invoice date");
});

test("dispatch edit validation allows valid commercial payload", async () => {
  const { nextCalled, res } = runMiddleware(validateDispatchEditInput, {
    dispatchDate: "2026-04-15",
    sourceType: "Plant",
    plantId: 1,
    materialId: 1,
    vehicleId: 1,
    partyId: 1,
    destinationName: "Site A",
    quantityTons: 12.5,
    invoiceValue: 2500,
    distanceKm: 18,
    otherCharge: 150,
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("dispatch status validation rejects invalid status", async () => {
  const { res, nextCalled } = runMiddleware(validateDispatchStatusInput, {
    status: "archived",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /invalid dispatch status/i);
});

test("vehicle create validation requires vendor for transporter ownership", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateVehicleInput, {
    vehicleNumber: "UP32AB1234",
    vehicleType: "Tipper",
    ownershipType: "transporter",
    plantId: 2,
    status: "active",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /vendorId/i);
});

test("vehicle status validation accepts supported status", async () => {
  const { nextCalled, res } = runMiddleware(validateVehicleStatusUpdate, {
    status: "maintenance",
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("party validation rejects invalid GSTIN", async () => {
  const { res, nextCalled } = runMiddleware(validateCreatePartyInput, {
    partyName: "Acme Infra",
    gstin: "BADGSTIN",
    partyType: "customer",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /gstin/i);
});

test("party status validation requires boolean isActive", async () => {
  const { res, nextCalled } = runMiddleware(validatePartyStatusPayload, {
    isActive: "yes",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /isActive/i);
});

test("vendor validation rejects invalid vendor type", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateVendorInput, {
    vendorName: "Fast Logistics",
    vendorType: "Broker",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /invalid vendor type/i);
});

test("vendor validation allows custom other vendor type", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateVendorInput, {
    vendorName: "Fast Logistics",
    vendorType: "Other: Marine Contractor",
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("vendor status validation requires boolean isActive", async () => {
  const { res, nextCalled } = runMiddleware(validateVendorStatusPayload, {
    isActive: 1,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /isActive/i);
});

test("plant validation rejects malformed custom power source", async () => {
  const { res, nextCalled } = runMiddleware(validateCreatePlantInput, {
    plantName: "Main Crusher",
    plantType: "Crusher",
    powerSourceType: "Other:",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /powerSourceType/i);
});

test("plant validation allows future custom plant type labels", async () => {
  const { res, nextCalled } = runMiddleware(validateCreatePlantInput, {
    plantName: "Main Crusher",
    plantType: "Mobile Recycle Unit",
    powerSourceType: "solar",
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("plant validation allows custom other plant type and power source", async () => {
  const { res, nextCalled } = runMiddleware(validateCreatePlantInput, {
    plantName: "Main Crusher",
    plantType: "Other: Recycle Unit",
    powerSourceType: "other:solar",
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("plant status validation requires boolean isActive", async () => {
  const { res, nextCalled } = runMiddleware(validatePlantStatusPayload, {
    isActive: "false",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /isActive/i);
});

test("party material rate validation rejects non-positive rate", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateRateInput, {
    plantId: 1,
    partyId: 1,
    materialId: 1,
    ratePerTon: 0,
    royaltyMode: "none",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /ratePerTon/i);
});

test("party material rate validation requires tonsPerBrass for per_brass mode", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateRateInput, {
    plantId: 1,
    partyId: 1,
    materialId: 1,
    ratePerTon: 1000,
    royaltyMode: "per_brass",
    royaltyValue: 200,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /tonsPerBrass/i);
});

test("party material rate validation accepts valid per_brass payload", async () => {
  const { res, nextCalled } = runMiddleware(validateCreateRateInput, {
    plantId: 1,
    partyId: 1,
    materialId: 1,
    ratePerTon: 1000,
    royaltyMode: "per_brass",
    royaltyValue: 200,
    tonsPerBrass: 2.83,
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("party material rate status validation requires boolean isActive", async () => {
  const { res, nextCalled } = runMiddleware(validateRateStatusPayload, {
    isActive: 1,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /isActive/i);
});

test("company profile validation rejects invalid GSTIN", async () => {
  const { res, nextCalled } = runMiddleware(validateCompanyProfilePayload, {
    companyName: "Apex Infra",
    gstin: "BADGSTIN",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /gstin/i);
});

test("company profile validation rejects invalid logo data URL", async () => {
  const { res, nextCalled } = runMiddleware(validateCompanyProfilePayload, {
    companyName: "Apex Infra",
    logoUrl: "https://example.com/logo.png",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /logoUrl/i);
});

test("company profile validation accepts valid logo data URL", async () => {
  const { res, nextCalled } = runMiddleware(validateCompanyProfilePayload, {
    companyName: "Apex Infra",
    logoUrl: "data:image/png;base64,AAAA",
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("party order validation rejects zero quantity", async () => {
  const { res, nextCalled } = runMiddleware(validatePartyOrderPayload, {
    orderNumber: "PO-001",
    orderDate: "2026-04-16",
    partyId: 1,
    plantId: 1,
    materialId: 1,
    orderedQuantityTons: 0,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /orderedQuantityTons/i);
});

test("party order status validation rejects unsupported status", async () => {
  const { res, nextCalled } = runMiddleware(validatePartyOrderStatusPayload, {
    status: "archived",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /invalid party order status/i);
});

test("forgot password validation requires identifier and mobile number", async () => {
  const { res, nextCalled } = runMiddleware(validateForgotPasswordInput, {
    identifier: "",
    mobileNumber: "",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /identifier and mobileNumber/i);
});

test("forgot password validation rejects too-short mobile numbers", async () => {
  const { res, nextCalled } = runMiddleware(validateForgotPasswordInput, {
    identifier: "EMP0001",
    mobileNumber: "12345",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "mobileNumber must contain at least 10 digits");
});

test("reset password validation rejects short passwords", async () => {
  const { res, nextCalled } = runMiddleware(validateResetPasswordInput, {
    resetOtp: "123456",
    newPassword: "short",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, STRONG_PASSWORD_MESSAGE);
});

test("change password validation rejects weak passwords", async () => {
  const { res, nextCalled } = runMiddleware(validateChangePasswordInput, {
    currentPassword: "Temp!1234",
    newPassword: "alllowercase1",
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, STRONG_PASSWORD_MESSAGE);
});

test("admin reset password validation requires employeeId", async () => {
  const { res, nextCalled } = runMiddleware(validateAdminResetPasswordInput, {});

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "employeeId is required");
});

test("refresh session validation requires refreshToken", async () => {
  const { res, nextCalled } = runMiddleware(validateRefreshSessionInput, {});

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "refreshToken is required");
});

test("logout session validation requires refreshToken", async () => {
  const { res, nextCalled } = runMiddleware(validateLogoutSessionInput, {});

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "refreshToken is required");
});
