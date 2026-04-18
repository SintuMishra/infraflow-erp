const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateCreatePayablePayload,
} = require("../src/modules/accounts_payable/accounts_payable.validation");
const {
  validateCreateCashBankVoucherPayload,
} = require("../src/modules/cash_bank/cash_bank.validation");
const {
  validateCreateVoucherInput,
  validateTransitionHistoryQuery,
  validateFinancePolicyPayload,
} = require("../src/modules/general_ledger/general_ledger.validation");
const {
  validateDateRangeQuery,
} = require("../src/modules/financial_reports/financial_reports.validation");

const runValidation = (middleware, body) => {
  const req = { body, query: {} };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, statusCode: res.statusCode, payload: res.payload };
};

const runQueryValidation = (middleware, query) => {
  const req = { body: {}, query };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, statusCode: res.statusCode, payload: res.payload };
};

test("validateCreatePayablePayload rejects payload with both partyId and vendorId", () => {
  const result = runValidation(validateCreatePayablePayload, {
    amount: 100,
    billDate: "2026-04-18",
    dueDate: "2026-04-20",
    partyId: 10,
    vendorId: 20,
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(String(result.payload?.message || ""), /exactly one/i);
});

test("validateCreatePayablePayload rejects dueDate before billDate", () => {
  const result = runValidation(validateCreatePayablePayload, {
    amount: 100,
    billDate: "2026-04-20",
    dueDate: "2026-04-18",
    partyId: 10,
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(String(result.payload?.message || ""), /cannot be before/i);
});

test("validateCreateCashBankVoucherPayload rejects unsupported voucherType", () => {
  const result = runValidation(validateCreateCashBankVoucherPayload, {
    voucherType: "journal",
    voucherDate: "2026-04-18",
    amount: 100,
    cashOrBankLedgerId: 1,
    counterAccountId: 2,
    counterLedgerId: 3,
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(String(result.payload?.message || ""), /receipt\/payment\/contra/i);
});

test("validateCreateVoucherInput requires full source linkage tuple when partial source is supplied", () => {
  const result = runValidation(validateCreateVoucherInput, {
    voucherType: "journal",
    voucherDate: "2026-04-18",
    sourceModule: "dispatch",
    sourceRecordId: 99,
    lines: [
      { accountId: 1, ledgerId: 1, debit: 100, credit: 0 },
      { accountId: 2, ledgerId: 2, debit: 0, credit: 100 },
    ],
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(String(result.payload?.message || ""), /provided together/i);
});

test("validateDateRangeQuery rejects invalid report date range", () => {
  const result = runQueryValidation(validateDateRangeQuery, {
    dateFrom: "2026-04-20",
    dateTo: "2026-04-18",
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(String(result.payload?.message || ""), /cannot be earlier/i);
});

test("validateTransitionHistoryQuery rejects invalid action filter", () => {
  const result = runQueryValidation(validateTransitionHistoryQuery, {
    action: "unsafe_action",
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(String(result.payload?.message || ""), /Unsupported transition action/i);
});

test("validateTransitionHistoryQuery rejects invalid date range", () => {
  const result = runQueryValidation(validateTransitionHistoryQuery, {
    dateFrom: "2026-04-20",
    dateTo: "2026-04-01",
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(String(result.payload?.message || ""), /cannot be earlier/i);
});

test("validateTransitionHistoryQuery accepts valid filtered payload", () => {
  const result = runQueryValidation(validateTransitionHistoryQuery, {
    entityType: "voucher",
    entityId: "12",
    action: "post",
    performedByUserId: "15",
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
    limit: "100",
    page: "2",
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
});

test("validateTransitionHistoryQuery rejects unsupported format", () => {
  const result = runQueryValidation(validateTransitionHistoryQuery, {
    format: "pdf",
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(String(result.payload?.message || ""), /format must be json\/csv/i);
});

test("validateFinancePolicyPayload requires all toggles as booleans", () => {
  const result = runValidation(validateFinancePolicyPayload, {
    allowSubmitterSelfApproval: true,
    allowMakerSelfApproval: "yes",
    allowApproverSelfPosting: false,
    allowMakerSelfPosting: false,
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(String(result.payload?.message || ""), /allowMakerSelfApproval must be boolean/i);
});

test("validateFinancePolicyPayload accepts safe payload", () => {
  const result = runValidation(validateFinancePolicyPayload, {
    allowSubmitterSelfApproval: false,
    allowMakerSelfApproval: false,
    allowApproverSelfPosting: false,
    allowMakerSelfPosting: false,
    lastUpdateNotes: "Monthly governance review",
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
});
