const { pool, withTransaction } = require("../../config/db");
const { tableExists } = require("../../utils/companyScope.util");

const VOUCHER_TYPES = new Set([
  "journal",
  "payment",
  "receipt",
  "contra",
  "sales_invoice",
  "purchase_bill",
  "reversal",
]);

const VOUCHER_APPROVAL_STATES = new Set(["draft", "submitted", "approved", "rejected"]);
const FINANCE_TRANSITION_ACTIONS = new Set([
  "create",
  "submit",
  "approve",
  "post",
  "reject",
  "reverse",
  "close",
  "reopen",
  "close_period",
  "reopen_period",
]);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnly = (value, fieldName = "date") => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value || "").trim();
  if (!raw) {
    const error = new Error(`${fieldName} must use YYYY-MM-DD format`);
    error.statusCode = 400;
    throw error;
  }

  const isoCandidate = raw.slice(0, 10);
  if (ISO_DATE_PATTERN.test(isoCandidate)) {
    return isoCandidate;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const error = new Error(`${fieldName} must use YYYY-MM-DD format`);
  error.statusCode = 400;
  throw error;
};

const isPolicyEnabled = (envName) =>
  ["1", "true", "yes"].includes(String(process.env[envName] || "").trim().toLowerCase());

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeVoucherType = (value) => String(value || "").trim().toLowerCase();

const assertVoucherType = (voucherType) => {
  if (!VOUCHER_TYPES.has(voucherType)) {
    const error = new Error("Invalid voucherType");
    error.statusCode = 400;
    throw error;
  }
};

const normalizeSourceText = (value) => String(value || "").trim();

const normalizeApprovalStatus = (value) => String(value || "").trim().toLowerCase();

const assertApprovalStatus = (approvalStatus) => {
  if (!VOUCHER_APPROVAL_STATES.has(approvalStatus)) {
    const error = new Error("approvalStatus must be draft/submitted/approved/rejected");
    error.statusCode = 400;
    throw error;
  }
};

const deriveWorkflowState = (voucher) => {
  const status = String(voucher?.status || "").toLowerCase();
  const approvalStatus = String(voucher?.approvalStatus || "").toLowerCase();

  if (status === "posted") {
    return "posted";
  }

  if (status === "reversed") {
    return "reversed";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  if (status !== "draft") {
    return status || "unknown";
  }

  if (approvalStatus === "submitted") {
    return "submitted";
  }
  if (approvalStatus === "approved") {
    return "approved";
  }
  if (approvalStatus === "rejected") {
    return "rejected";
  }
  return "draft";
};

const assertSourceReference = ({ sourceModule, sourceRecordId, sourceEvent }) => {
  const moduleText = normalizeSourceText(sourceModule);
  const eventText = normalizeSourceText(sourceEvent);
  const hasRecordId = Number.isInteger(Number(sourceRecordId)) && Number(sourceRecordId) > 0;

  if (!moduleText && !eventText && !hasRecordId) {
    return { sourceModule: null, sourceRecordId: null, sourceEvent: null };
  }

  if (!moduleText || !eventText || !hasRecordId) {
    const error = new Error(
      "sourceModule, sourceRecordId, and sourceEvent must be provided together for source-linked postings"
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    sourceModule: moduleText,
    sourceRecordId: Number(sourceRecordId),
    sourceEvent: eventText,
  };
};

const ensureVoucherBalanced = (lines = []) => {
  if (!Array.isArray(lines) || lines.length < 2) {
    const error = new Error("At least two voucher lines are required");
    error.statusCode = 400;
    throw error;
  }

  let totalDebit = 0;
  let totalCredit = 0;

  lines.forEach((line, index) => {
    const debit = roundMoney(line?.debit || 0);
    const credit = roundMoney(line?.credit || 0);

    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
      const error = new Error(`Voucher line ${index + 1} must have either debit or credit`);
      error.statusCode = 400;
      throw error;
    }

    if (!line?.ledgerId || !line?.accountId) {
      const error = new Error(`Voucher line ${index + 1} requires accountId and ledgerId`);
      error.statusCode = 400;
      throw error;
    }

    totalDebit += debit;
    totalCredit += credit;
  });

  totalDebit = roundMoney(totalDebit);
  totalCredit = roundMoney(totalCredit);

  if (Math.abs(totalDebit - totalCredit) >= 0.01) {
    const error = new Error("Voucher is unbalanced: total debit must equal total credit");
    error.statusCode = 400;
    throw error;
  }

  return {
    totalDebit,
    totalCredit,
  };
};

const getNextVoucherNumber = async ({ companyId, voucherType, voucherDate, db = pool }) => {
  const safeType = String(voucherType || "JV").slice(0, 3).toUpperCase();
  const datePart = toDateOnly(voucherDate, "voucherDate").replace(/-/g, "");
  const prefix = `${safeType}-${datePart}-`;

  const result = await db.query(
    `
    SELECT voucher_number AS "voucherNumber"
    FROM vouchers
    WHERE company_id = $1
      AND voucher_number LIKE $2
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, `${prefix}%`]
  );

  const lastVoucherNumber = String(result.rows[0]?.voucherNumber || "").trim();
  const match = lastVoucherNumber.match(/-(\d{4})$/);
  const nextSeq = match ? Number(match[1]) + 1 : 1;

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
};

const getLedgerById = async ({ ledgerId, companyId, db = pool }) => {
  const result = await db.query(
    `
    SELECT
      l.*,
      a.account_type AS "accountType",
      a.allow_direct_posting AS "allowDirectPosting",
      a.is_active AS "accountIsActive"
    FROM ledgers l
    INNER JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE l.id = $1 AND l.company_id = $2
    LIMIT 1
    `,
    [ledgerId, companyId]
  );

  return result.rows[0] || null;
};

const assertEntityInCompany = async ({ tableName, entityId, companyId, label, db = pool }) => {
  if (!entityId) {
    return;
  }

  if (!(await tableExists(tableName, db))) {
    return;
  }

  const result = await db.query(
    `
    SELECT id
    FROM ${tableName}
    WHERE id = $1
      AND company_id = $2
    LIMIT 1
    `,
    [Number(entityId), companyId]
  );

  if (!result.rows[0]?.id) {
    const error = new Error(`${label} is not in company scope`);
    error.statusCode = 400;
    throw error;
  }
};

const resolveAccountingPeriod = async ({
  companyId,
  voucherDate,
  accountingPeriodId = null,
  requireOpen = false,
  db = pool,
}) => {
  const normalizedVoucherDate = toDateOnly(voucherDate, "voucherDate");

  if (!(await tableExists("accounting_periods", db))) {
    return null;
  }

  if (accountingPeriodId) {
    const periodResult = await db.query(
      `
      SELECT
        id,
        period_start AS "periodStart",
        period_end AS "periodEnd",
        status
      FROM accounting_periods
      WHERE id = $1 AND company_id = $2
      LIMIT 1
      `,
      [accountingPeriodId, companyId]
    );
    const period = periodResult.rows[0] || null;
    if (!period) {
      const error = new Error("Selected accounting period not found in company scope");
      error.statusCode = 400;
      throw error;
    }

    if (requireOpen && period.status !== "open") {
      const error = new Error("Selected accounting period is not open");
      error.statusCode = 409;
      throw error;
    }

    const periodStart = toDateOnly(period.periodStart, "periodStart");
    const periodEnd = toDateOnly(period.periodEnd, "periodEnd");
    if (normalizedVoucherDate < periodStart || normalizedVoucherDate > periodEnd) {
      const error = new Error("voucherDate does not fall in selected accounting period");
      error.statusCode = 400;
      throw error;
    }

    return period;
  }

  const periodResult = await db.query(
    `
    SELECT
      id,
      period_start AS "periodStart",
      period_end AS "periodEnd",
      status
    FROM accounting_periods
    WHERE company_id = $1
      AND period_start <= $2::date
      AND period_end >= $2::date
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, normalizedVoucherDate]
  );
  const period = periodResult.rows[0] || null;

  if (!period) {
    const error = new Error("No accounting period found for voucherDate");
    error.statusCode = 409;
    throw error;
  }

  if (requireOpen && period.status !== "open") {
    const error = new Error("Accounting period is not open for voucher posting");
    error.statusCode = 409;
    throw error;
  }

  return period;
};

const getFinancePolicyControls = async ({ companyId, db = pool }) => {
  const defaults = {
    allowSubmitterSelfApproval: false,
    allowMakerSelfApproval: false,
    allowApproverSelfPosting: false,
    allowMakerSelfPosting: false,
    lastUpdateNotes: null,
    updatedAt: null,
    updatedByUserId: null,
    updatedByDisplayName: null,
  };

  if (!(await tableExists("finance_policy_controls", db))) {
    return {
      allowSubmitterSelfApproval: isPolicyEnabled("FINANCE_ALLOW_SELF_APPROVAL"),
      allowMakerSelfApproval: isPolicyEnabled("FINANCE_ALLOW_SELF_APPROVAL"),
      allowApproverSelfPosting: isPolicyEnabled("FINANCE_ALLOW_SELF_POSTING"),
      allowMakerSelfPosting: isPolicyEnabled("FINANCE_ALLOW_SELF_POSTING"),
    };
  }

  const result = await db.query(
    `
    SELECT
      fpc.allow_submitter_self_approval AS "allowSubmitterSelfApproval",
      fpc.allow_maker_self_approval AS "allowMakerSelfApproval",
      fpc.allow_approver_self_posting AS "allowApproverSelfPosting",
      fpc.allow_maker_self_posting AS "allowMakerSelfPosting",
      fpc.last_update_notes AS "lastUpdateNotes",
      fpc.updated_at AS "updatedAt",
      fpc.updated_by_user_id AS "updatedByUserId",
      COALESCE(NULLIF(BTRIM(e.full_name), ''), NULLIF(BTRIM(u.username), '')) AS "updatedByDisplayName"
    FROM finance_policy_controls fpc
    LEFT JOIN users u ON u.id = fpc.updated_by_user_id
    LEFT JOIN employees e ON e.id = u.employee_id
    WHERE fpc.company_id = $1
    LIMIT 1
    `,
    [companyId]
  );

  return {
    ...defaults,
    ...(result.rows[0] || {}),
  };
};

const updateFinancePolicyControls = async ({
  companyId,
  userId,
  allowSubmitterSelfApproval,
  allowMakerSelfApproval,
  allowApproverSelfPosting,
  allowMakerSelfPosting,
  lastUpdateNotes = "",
  db = pool,
}) => {
  if (!(await tableExists("finance_policy_controls", db))) {
    const error = new Error("Finance policy controls are not initialized. Run migrations first.");
    error.statusCode = 409;
    throw error;
  }

  if (!Number(userId || 0)) {
    const error = new Error("userId is required for policy updates");
    error.statusCode = 400;
    throw error;
  }

  const values = [
    companyId,
    Boolean(allowSubmitterSelfApproval),
    Boolean(allowMakerSelfApproval),
    Boolean(allowApproverSelfPosting),
    Boolean(allowMakerSelfPosting),
    Number(userId),
    String(lastUpdateNotes || "").trim() || null,
  ];

  const result = await db.query(
    `
    INSERT INTO finance_policy_controls (
      company_id,
      allow_submitter_self_approval,
      allow_maker_self_approval,
      allow_approver_self_posting,
      allow_maker_self_posting,
      updated_by_user_id,
      last_update_notes,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)
    ON CONFLICT (company_id)
    DO UPDATE
    SET
      allow_submitter_self_approval = EXCLUDED.allow_submitter_self_approval,
      allow_maker_self_approval = EXCLUDED.allow_maker_self_approval,
      allow_approver_self_posting = EXCLUDED.allow_approver_self_posting,
      allow_maker_self_posting = EXCLUDED.allow_maker_self_posting,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      last_update_notes = EXCLUDED.last_update_notes,
      updated_at = CURRENT_TIMESTAMP
    RETURNING company_id AS "companyId"
    `,
    values
  );

  return getFinancePolicyControls({
    companyId: result.rows[0]?.companyId || companyId,
    db,
  });
};

const assertSourcePostingAllowed = async ({
  companyId,
  sourceModule = null,
  sourceRecordId = null,
  sourceEvent = null,
  db = pool,
}) => {
  if (!sourceModule || !sourceRecordId || !sourceEvent) {
    return;
  }

  if (!(await tableExists("finance_source_links", db))) {
    return;
  }

  const existingLinkResult = await db.query(
    `
    SELECT id, posting_status AS "postingStatus", voucher_id AS "voucherId"
    FROM finance_source_links
    WHERE company_id = $1
      AND source_module = $2
      AND source_record_id = $3
      AND source_event = $4
    LIMIT 1
    `,
    [companyId, sourceModule, sourceRecordId, sourceEvent]
  );

  const existing = existingLinkResult.rows[0] || null;
  if (!existing) {
    return;
  }

  if (
    ["posted", "pending", "reversed"].includes(String(existing.postingStatus || "").toLowerCase()) &&
    existing.voucherId
  ) {
    const error = new Error(
      `Financial source already linked to voucher (status: ${existing.postingStatus}). Duplicate posting blocked.`
    );
    error.statusCode = 409;
    throw error;
  }
};

const getVoucherById = async ({ voucherId, companyId, db = pool }) => {
  const voucherResult = await db.query(
    `
    SELECT
      id,
      company_id AS "companyId",
      voucher_number AS "voucherNumber",
      voucher_type AS "voucherType",
      voucher_date AS "voucherDate",
      accounting_period_id AS "accountingPeriodId",
      status,
      approval_status AS "approvalStatus",
      narration,
      total_debit AS "totalDebit",
      total_credit AS "totalCredit",
      source_module AS "sourceModule",
      source_record_id AS "sourceRecordId",
      submitted_by_user_id AS "submittedByUserId",
      submitted_at AS "submittedAt",
      approved_by_user_id AS "approvedByUserId",
      approved_at AS "approvedAt",
      rejected_by_user_id AS "rejectedByUserId",
      rejected_at AS "rejectedAt",
      posted_by_user_id AS "postedByUserId",
      posted_at AS "postedAt",
      reversed_by_user_id AS "reversedByUserId",
      reversed_at AS "reversedAt",
      reversal_of_voucher_id AS "reversalOfVoucherId",
      reversed_from_voucher_id AS "reversedFromVoucherId",
      created_by_user_id AS "createdByUserId",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM vouchers
    WHERE id = $1 AND company_id = $2
    LIMIT 1
    `,
    [voucherId, companyId]
  );

  const voucher = voucherResult.rows[0] || null;
  if (!voucher) {
    return null;
  }

  const linesResult = await db.query(
    `
    SELECT
      vl.id,
      vl.line_number AS "lineNumber",
      vl.account_id AS "accountId",
      a.account_name AS "accountName",
      vl.ledger_id AS "ledgerId",
      l.ledger_name AS "ledgerName",
      vl.party_id AS "partyId",
      p.party_name AS "partyName",
      vl.vendor_id AS "vendorId",
      v.vendor_name AS "vendorName",
      vl.plant_id AS "plantId",
      pm.plant_name AS "plantName",
      vl.project_id AS "projectId",
      pr.project_name AS "projectName",
      vl.vehicle_id AS "vehicleId",
      vh.vehicle_number AS "vehicleNumber",
      vl.debit,
      vl.credit,
      vl.line_narration AS "lineNarration"
    FROM voucher_lines vl
    INNER JOIN chart_of_accounts a ON a.id = vl.account_id
    INNER JOIN ledgers l ON l.id = vl.ledger_id
    LEFT JOIN party_master p ON p.id = vl.party_id
    LEFT JOIN vendor_master v ON v.id = vl.vendor_id
    LEFT JOIN plant_master pm ON pm.id = vl.plant_id
    LEFT JOIN (
      SELECT DISTINCT id, project_name
      FROM project_daily_reports
    ) pr ON pr.id = vl.project_id
    LEFT JOIN vehicles vh ON vh.id = vl.vehicle_id
    WHERE vl.voucher_id = $1
    ORDER BY vl.line_number ASC, vl.id ASC
    `,
    [voucherId]
  );

  return {
    ...voucher,
    workflowState: deriveWorkflowState(voucher),
    lines: linesResult.rows,
  };
};

const lockVoucherRow = async ({ voucherId, companyId, db = pool }) => {
  const result = await db.query(
    `
    SELECT id
    FROM vouchers
    WHERE id = $1
      AND company_id = $2
    FOR UPDATE
    `,
    [voucherId, companyId]
  );

  return result.rows[0] || null;
};

const appendFinanceTransitionLog = async ({
  companyId,
  entityType,
  entityId,
  fromState = null,
  toState,
  action,
  performedByUserId,
  remarks = "",
  metadata = null,
  db = pool,
}) => {
  if (!(await tableExists("finance_transition_logs", db))) {
    return null;
  }

  if (!Number(performedByUserId || 0)) {
    const error = new Error("Finance transition requires performedByUserId");
    error.statusCode = 400;
    throw error;
  }

  const safeAction = String(action || "").trim().toLowerCase();
  if (!FINANCE_TRANSITION_ACTIONS.has(safeAction)) {
    const error = new Error("Unsupported finance transition action");
    error.statusCode = 400;
    throw error;
  }

  const result = await db.query(
    `
    INSERT INTO finance_transition_logs (
      company_id,
      entity_type,
      entity_id,
      from_state,
      to_state,
      action,
      performed_by_user_id,
      remarks,
      metadata
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING
      id,
      company_id AS "companyId",
      entity_type AS "entityType",
      entity_id AS "entityId",
      from_state AS "fromState",
      to_state AS "toState",
      action,
      performed_by_user_id AS "performedByUserId",
      remarks,
      metadata,
      created_at AS "createdAt"
    `,
    [
      companyId,
      String(entityType || "").trim().toLowerCase(),
      Number(entityId),
      fromState ? String(fromState).trim().toLowerCase() : null,
      String(toState || "").trim().toLowerCase(),
      safeAction,
      Number(performedByUserId),
      String(remarks || "").trim() || null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );

  return result.rows[0] || null;
};

const createVoucher = async ({
  companyId,
  voucherType,
  voucherDate,
  accountingPeriodId = null,
  approvalStatus = "draft",
  narration = "",
  sourceModule = null,
  sourceRecordId = null,
  sourceEvent = null,
  lines = [],
  createdByUserId = null,
  db = pool,
}) => {
  const normalizedType = normalizeVoucherType(voucherType);
  assertVoucherType(normalizedType);
  const normalizedDate = String(voucherDate || "").trim();
  const sourceRef = assertSourceReference({
    sourceModule,
    sourceRecordId,
    sourceEvent,
  });

  if (!ISO_DATE_PATTERN.test(normalizedDate)) {
    const error = new Error("voucherDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  const safeApprovalStatus = String(approvalStatus || "draft").trim().toLowerCase();
  assertApprovalStatus(safeApprovalStatus);

  const { totalDebit, totalCredit } = ensureVoucherBalanced(lines);
  await resolveAccountingPeriod({
    companyId,
    voucherDate: normalizedDate,
    accountingPeriodId,
    requireOpen: false,
    db,
  });
  await assertSourcePostingAllowed({
    companyId,
    sourceModule: sourceRef.sourceModule,
    sourceRecordId: sourceRef.sourceRecordId,
    sourceEvent: sourceRef.sourceEvent,
    db,
  });

  for (const [index, line] of lines.entries()) {
    if (line.partyId && line.vendorId) {
      const error = new Error(`Voucher line ${index + 1} cannot have both partyId and vendorId`);
      error.statusCode = 400;
      throw error;
    }

    const ledger = await getLedgerById({
      ledgerId: Number(line.ledgerId),
      companyId,
      db,
    });

    if (!ledger) {
      const error = new Error(`Ledger not found for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (!ledger.is_active || !ledger.accountIsActive) {
      const error = new Error(`Ledger is inactive for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (Number(ledger.account_id) !== Number(line.accountId)) {
      const error = new Error(`Account and ledger mismatch for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (line.partyId && ledger.party_id && Number(line.partyId) !== Number(ledger.party_id)) {
      const error = new Error(`Party and ledger mapping mismatch for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (line.vendorId && ledger.vendor_id && Number(line.vendorId) !== Number(ledger.vendor_id)) {
      const error = new Error(`Vendor and ledger mapping mismatch for line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (ledger.party_id && !line.partyId) {
      const error = new Error(`partyId is required for party-mapped ledger on line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    if (ledger.vendor_id && !line.vendorId) {
      const error = new Error(`vendorId is required for vendor-mapped ledger on line ${index + 1}`);
      error.statusCode = 400;
      throw error;
    }

    await assertEntityInCompany({
      tableName: "party_master",
      entityId: line.partyId || null,
      companyId,
      label: `partyId for line ${index + 1}`,
      db,
    });
    await assertEntityInCompany({
      tableName: "vendor_master",
      entityId: line.vendorId || null,
      companyId,
      label: `vendorId for line ${index + 1}`,
      db,
    });
    await assertEntityInCompany({
      tableName: "plant_master",
      entityId: line.plantId || null,
      companyId,
      label: `plantId for line ${index + 1}`,
      db,
    });
    await assertEntityInCompany({
      tableName: "vehicles",
      entityId: line.vehicleId || null,
      companyId,
      label: `vehicleId for line ${index + 1}`,
      db,
    });
  }

  const voucherNumber = await getNextVoucherNumber({
    companyId,
    voucherType: normalizedType,
    voucherDate: normalizedDate,
    db,
  });

  const voucherInsert = await db.query(
    `
    INSERT INTO vouchers (
      company_id,
      voucher_number,
      voucher_type,
      voucher_date,
      accounting_period_id,
      status,
      approval_status,
      narration,
      total_debit,
      total_credit,
      source_module,
      source_record_id,
      created_by_user_id,
      updated_by_user_id
    )
    VALUES (
      $1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11,$12,$13
    )
    RETURNING id
    `,
    [
      companyId,
      voucherNumber,
      normalizedType,
      normalizedDate,
      accountingPeriodId || null,
      safeApprovalStatus,
      String(narration || "").trim() || null,
      totalDebit,
      totalCredit,
      sourceRef.sourceModule,
      sourceRef.sourceRecordId,
      createdByUserId || null,
      createdByUserId || null,
    ]
  );

  const voucherId = voucherInsert.rows[0]?.id;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    await db.query(
      `
      INSERT INTO voucher_lines (
        voucher_id,
        company_id,
        line_number,
        account_id,
        ledger_id,
        party_id,
        vendor_id,
        plant_id,
        project_id,
        vehicle_id,
        line_narration,
        debit,
        credit,
        source_module,
        source_record_id
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )
      `,
      [
        voucherId,
        companyId,
        index + 1,
        Number(line.accountId),
        Number(line.ledgerId),
        line.partyId || null,
        line.vendorId || null,
        line.plantId || null,
        line.projectId || null,
        line.vehicleId || null,
        String(line.lineNarration || "").trim() || null,
        roundMoney(line.debit || 0),
        roundMoney(line.credit || 0),
        sourceRef.sourceModule,
        sourceRef.sourceRecordId,
      ]
    );
  }
  if (Number(createdByUserId || 0) > 0) {
    await appendFinanceTransitionLog({
      companyId,
      entityType: "voucher",
      entityId: voucherId,
      fromState: null,
      toState: "draft",
      action: "create",
      performedByUserId: Number(createdByUserId),
      remarks: String(narration || "").trim() || null,
      db,
    });
  }

  return getVoucherById({ voucherId, companyId, db });
};

const postVoucher = async ({ voucherId, companyId, postedByUserId = null, db = pool }) => {
  if (db === pool) {
    return withTransaction((tx) =>
      postVoucher({
        voucherId,
        companyId,
        postedByUserId,
        db: tx,
      })
    );
  }

  const locked = await lockVoucherRow({ voucherId, companyId, db });
  if (!locked) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  const voucher = await getVoucherById({ voucherId, companyId, db });
  if (!voucher) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  const workflowState = deriveWorkflowState(voucher);

  if (workflowState === "posted") {
    return voucher;
  }

  if (!["approved"].includes(workflowState)) {
    const error = new Error("Only approved vouchers can be posted");
    error.statusCode = 400;
    throw error;
  }

  if (!Number(postedByUserId || 0)) {
    const error = new Error("postedByUserId is required for voucher posting");
    error.statusCode = 400;
    throw error;
  }

  const policy = await getFinancePolicyControls({ companyId, db });

  if (
    Number(voucher.createdByUserId || 0) > 0 &&
    Number(postedByUserId || 0) > 0 &&
    Number(voucher.createdByUserId) === Number(postedByUserId) &&
    !policy.allowMakerSelfPosting
  ) {
    const error = new Error("Maker cannot post their own voucher as per finance policy");
    error.statusCode = 403;
    throw error;
  }

  if (
    Number(voucher.approvedByUserId || 0) > 0 &&
    Number(voucher.approvedByUserId) === Number(postedByUserId) &&
    !policy.allowApproverSelfPosting
  ) {
    const error = new Error("Approver cannot post the same voucher as per finance policy");
    error.statusCode = 403;
    throw error;
  }

  await resolveAccountingPeriod({
    companyId,
    voucherDate: toDateOnly(voucher.voucherDate, "voucherDate"),
    accountingPeriodId: voucher.accountingPeriodId || null,
    requireOpen: true,
    db,
  });

  ensureVoucherBalanced(voucher.lines);

  await db.query(
    `
    UPDATE vouchers
    SET
      status = 'posted',
      posted_by_user_id = $1,
      posted_at = CURRENT_TIMESTAMP,
      updated_by_user_id = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND company_id = $3
    `,
    [postedByUserId || null, voucherId, companyId]
  );
  await appendFinanceTransitionLog({
    companyId,
    entityType: "voucher",
    entityId: voucherId,
    fromState: workflowState,
    toState: "posted",
    action: "post",
    performedByUserId: Number(postedByUserId),
    remarks: voucher.narration || null,
    db,
  });

  return getVoucherById({ voucherId, companyId, db });
};

const submitVoucher = async ({ voucherId, companyId, submittedByUserId = null, db = pool }) => {
  const locked = await lockVoucherRow({ voucherId, companyId, db });
  if (!locked) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  const voucher = await getVoucherById({ voucherId, companyId, db });
  if (!voucher) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  const workflowState = deriveWorkflowState(voucher);
  if (!["draft", "rejected"].includes(workflowState)) {
    const error = new Error("Only draft/rejected vouchers can be submitted");
    error.statusCode = 409;
    throw error;
  }

  if (!Number(submittedByUserId || 0)) {
    const error = new Error("submittedByUserId is required for voucher submission");
    error.statusCode = 400;
    throw error;
  }

  await db.query(
    `
    UPDATE vouchers
    SET
      approval_status = 'submitted',
      submitted_by_user_id = $1,
      submitted_at = CURRENT_TIMESTAMP,
      rejected_by_user_id = NULL,
      rejected_at = NULL,
      updated_by_user_id = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND company_id = $3
    `,
    [submittedByUserId || null, voucherId, companyId]
  );

  await appendFinanceTransitionLog({
    companyId,
    entityType: "voucher",
    entityId: voucherId,
    fromState: workflowState,
    toState: "submitted",
    action: "submit",
    performedByUserId: Number(submittedByUserId),
    remarks: voucher.narration || null,
    db,
  });

  return getVoucherById({ voucherId, companyId, db });
};

const approveVoucher = async ({
  voucherId,
  companyId,
  approvedByUserId = null,
  approvalNotes = "",
  db = pool,
}) => {
  const locked = await lockVoucherRow({ voucherId, companyId, db });
  if (!locked) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  const voucher = await getVoucherById({ voucherId, companyId, db });
  if (!voucher) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  const workflowState = deriveWorkflowState(voucher);
  if (workflowState !== "submitted") {
    const error = new Error("Only submitted vouchers can be approved");
    error.statusCode = 409;
    throw error;
  }

  if (!Number(approvedByUserId || 0)) {
    const error = new Error("approvedByUserId is required for voucher approval");
    error.statusCode = 400;
    throw error;
  }

  const policy = await getFinancePolicyControls({ companyId, db });

  if (
    Number(voucher.createdByUserId || 0) > 0 &&
    Number(approvedByUserId || 0) > 0 &&
    Number(voucher.createdByUserId) === Number(approvedByUserId) &&
    !policy.allowMakerSelfApproval
  ) {
    const error = new Error("Maker cannot approve their own voucher as per finance policy");
    error.statusCode = 403;
    throw error;
  }

  if (
    Number(voucher.submittedByUserId || 0) > 0 &&
    Number(voucher.submittedByUserId) === Number(approvedByUserId) &&
    !policy.allowSubmitterSelfApproval
  ) {
    const error = new Error("Submitter cannot approve the same voucher as per finance policy");
    error.statusCode = 403;
    throw error;
  }

  await db.query(
    `
    UPDATE vouchers
    SET
      approval_status = 'approved',
      narration = COALESCE(NULLIF(BTRIM($1), ''), narration),
      approved_by_user_id = $2,
      approved_at = CURRENT_TIMESTAMP,
      rejected_by_user_id = NULL,
      rejected_at = NULL,
      updated_by_user_id = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND company_id = $4
    `,
    [String(approvalNotes || "").trim() || null, approvedByUserId || null, voucherId, companyId]
  );

  await appendFinanceTransitionLog({
    companyId,
    entityType: "voucher",
    entityId: voucherId,
    fromState: workflowState,
    toState: "approved",
    action: "approve",
    performedByUserId: Number(approvedByUserId),
    remarks: String(approvalNotes || "").trim() || null,
    db,
  });

  return getVoucherById({ voucherId, companyId, db });
};

const rejectVoucher = async ({
  voucherId,
  companyId,
  rejectedByUserId = null,
  rejectionReason = "",
  db = pool,
}) => {
  const locked = await lockVoucherRow({ voucherId, companyId, db });
  if (!locked) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  const voucher = await getVoucherById({ voucherId, companyId, db });
  if (!voucher) {
    const error = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }

  const workflowState = deriveWorkflowState(voucher);
  if (workflowState !== "submitted") {
    const error = new Error("Only submitted vouchers can be rejected");
    error.statusCode = 409;
    throw error;
  }

  if (!Number(rejectedByUserId || 0)) {
    const error = new Error("rejectedByUserId is required for voucher rejection");
    error.statusCode = 400;
    throw error;
  }

  await db.query(
    `
    UPDATE vouchers
    SET
      approval_status = 'rejected',
      narration = COALESCE(NULLIF(BTRIM($1), ''), narration),
      rejected_by_user_id = $2,
      rejected_at = CURRENT_TIMESTAMP,
      approved_by_user_id = NULL,
      approved_at = NULL,
      updated_by_user_id = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND company_id = $4
    `,
    [String(rejectionReason || "").trim() || null, rejectedByUserId || null, voucherId, companyId]
  );

  await appendFinanceTransitionLog({
    companyId,
    entityType: "voucher",
    entityId: voucherId,
    fromState: workflowState,
    toState: "rejected",
    action: "reject",
    performedByUserId: Number(rejectedByUserId),
    remarks: String(rejectionReason || "").trim() || null,
    db,
  });

  return getVoucherById({ voucherId, companyId, db });
};

const reverseVoucher = async ({
  voucherId,
  companyId,
  voucherDate,
  narration = "",
  userId = null,
  db = pool,
}) => {
  const locked = await lockVoucherRow({ voucherId, companyId, db });
  if (!locked) {
    const error = new Error("Voucher not found for reversal");
    error.statusCode = 404;
    throw error;
  }

  const originalVoucher = await getVoucherById({ voucherId, companyId, db });
  if (!originalVoucher) {
    const error = new Error("Voucher not found for reversal");
    error.statusCode = 404;
    throw error;
  }

  if (originalVoucher.status !== "posted") {
    const error = new Error("Only posted vouchers can be reversed");
    error.statusCode = 400;
    throw error;
  }

  const existingReversalResult = await db.query(
    `
    SELECT id
    FROM vouchers
    WHERE reversal_of_voucher_id = $1
      AND company_id = $2
    LIMIT 1
    `,
    [voucherId, companyId]
  );

  if (existingReversalResult.rows[0]?.id) {
    const error = new Error("Voucher is already reversed");
    error.statusCode = 409;
    throw error;
  }

  const reversalLines = originalVoucher.lines.map((line) => ({
    accountId: line.accountId,
    ledgerId: line.ledgerId,
    partyId: line.partyId || null,
    vendorId: line.vendorId || null,
    plantId: line.plantId || null,
    projectId: line.projectId || null,
    vehicleId: line.vehicleId || null,
    debit: Number(line.credit || 0),
    credit: Number(line.debit || 0),
    lineNarration: `Reversal of ${originalVoucher.voucherNumber}`,
  }));

  const reversalVoucher = await createVoucher({
    companyId,
    voucherType: "reversal",
    voucherDate,
    approvalStatus: "approved",
    narration: String(narration || "").trim() || `Reversal of voucher ${originalVoucher.voucherNumber}`,
    sourceModule: originalVoucher.sourceModule || "general_ledger",
    sourceRecordId: originalVoucher.id,
    sourceEvent: `voucher_reversal:${originalVoucher.id}`,
    lines: reversalLines,
    createdByUserId: userId,
    db,
  });

  await postVoucher({
    voucherId: reversalVoucher.id,
    companyId,
    postedByUserId: userId,
    db,
  });

  await db.query(
    `
    UPDATE vouchers
    SET
      status = 'reversed',
      reversed_from_voucher_id = $1,
      reversed_by_user_id = $2,
      reversed_at = CURRENT_TIMESTAMP,
      updated_by_user_id = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND company_id = $4
    `,
    [reversalVoucher.id, userId || null, voucherId, companyId]
  );

  if (Number(userId || 0) > 0) {
    await appendFinanceTransitionLog({
      companyId,
      entityType: "voucher",
      entityId: voucherId,
      fromState: "posted",
      toState: "reversed",
      action: "reverse",
      performedByUserId: Number(userId),
      remarks: String(narration || "").trim() || null,
      metadata: {
        reversalVoucherId: reversalVoucher.id,
      },
      db,
    });
  }

  await db.query(
    `
    UPDATE vouchers
    SET
      reversal_of_voucher_id = $1,
      updated_by_user_id = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND company_id = $4
    `,
    [voucherId, userId || null, reversalVoucher.id, companyId]
  );

  if (await tableExists("finance_source_links", db)) {
    await db.query(
      `
      UPDATE finance_source_links
      SET
        posting_status = 'reversed',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('reversalVoucherId', $1),
        updated_at = CURRENT_TIMESTAMP
      WHERE company_id = $2
        AND voucher_id = $3
      `,
      [reversalVoucher.id, companyId, voucherId]
    );
  }

  return {
    originalVoucher: await getVoucherById({ voucherId, companyId, db }),
    reversalVoucher: await getVoucherById({
      voucherId: reversalVoucher.id,
      companyId,
      db,
    }),
  };
};

const listVouchers = async ({
  companyId,
  voucherType = "",
  status = "",
  dateFrom = "",
  dateTo = "",
  search = "",
  limit = 50,
  page = 1,
  db = pool,
}) => {
  const values = [companyId];
  const filters = ["company_id = $1"];

  if (voucherType) {
    values.push(normalizeVoucherType(voucherType));
    filters.push(`voucher_type = $${values.length}`);
  }

  if (status) {
    values.push(String(status).trim().toLowerCase());
    filters.push(`status = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    filters.push(`voucher_date >= $${values.length}::date`);
  }

  if (dateTo) {
    values.push(dateTo);
    filters.push(`voucher_date <= $${values.length}::date`);
  }

  if (search) {
    values.push(`%${String(search).trim().toLowerCase()}%`);
    const token = `$${values.length}`;
    filters.push(`(
      LOWER(COALESCE(voucher_number, '')) LIKE ${token}
      OR LOWER(COALESCE(narration, '')) LIKE ${token}
      OR LOWER(COALESCE(source_module, '')) LIKE ${token}
    )`);
  }

  const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedLimit;

  values.push(normalizedLimit);
  values.push(offset);

  const whereClause = `WHERE ${filters.join(" AND ")}`;

  const result = await db.query(
    `
    SELECT
      id,
      voucher_number AS "voucherNumber",
      voucher_type AS "voucherType",
      voucher_date AS "voucherDate",
      status,
      approval_status AS "approvalStatus",
      narration,
      total_debit AS "totalDebit",
      total_credit AS "totalCredit",
      source_module AS "sourceModule",
      source_record_id AS "sourceRecordId",
      submitted_by_user_id AS "submittedByUserId",
      approved_by_user_id AS "approvedByUserId",
      rejected_by_user_id AS "rejectedByUserId",
      posted_by_user_id AS "postedByUserId",
      reversed_by_user_id AS "reversedByUserId",
      created_at AS "createdAt",
      posted_at AS "postedAt"
    FROM vouchers
    ${whereClause}
    ORDER BY voucher_date DESC, id DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
    `,
    values
  );

  const countValues = values.slice(0, values.length - 2);
  const countResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM vouchers
    ${whereClause}
    `,
    countValues
  );

  return {
    items: result.rows.map((voucher) => ({
      ...voucher,
      workflowState: deriveWorkflowState(voucher),
    })),
    total: Number(countResult.rows[0]?.total || 0),
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const getWorkflowInbox = async ({ companyId, limit = 50, db = pool }) => {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const [pendingRes, postingRes, rejectedRes, recentRes] = await Promise.all([
    db.query(
      `
      SELECT
        vouchers.id,
        vouchers.voucher_number AS "voucherNumber",
        vouchers.voucher_type AS "voucherType",
        vouchers.voucher_date AS "voucherDate",
        vouchers.approval_status AS "approvalStatus",
        vouchers.status,
        submitted_by_user_id AS "submittedByUserId",
        COALESCE(NULLIF(BTRIM(es.full_name), ''), NULLIF(BTRIM(us.username), '')) AS "submittedByDisplayName",
        submitted_at AS "submittedAt",
        created_by_user_id AS "createdByUserId",
        COALESCE(NULLIF(BTRIM(ec.full_name), ''), NULLIF(BTRIM(uc.username), '')) AS "createdByDisplayName",
        created_at AS "createdAt",
        GREATEST((CURRENT_DATE - DATE(COALESCE(submitted_at, created_at))), 0)::int AS "ageDays"
      FROM vouchers
      LEFT JOIN users us ON us.id = vouchers.submitted_by_user_id
      LEFT JOIN employees es ON es.id = us.employee_id
      LEFT JOIN users uc ON uc.id = vouchers.created_by_user_id
      LEFT JOIN employees ec ON ec.id = uc.employee_id
      WHERE vouchers.company_id = $1
        AND status = 'draft'
        AND approval_status = 'submitted'
      ORDER BY COALESCE(vouchers.submitted_at, vouchers.created_at) ASC, vouchers.id ASC
      LIMIT $2
      `,
      [companyId, normalizedLimit]
    ),
    db.query(
      `
      SELECT
        vouchers.id,
        vouchers.voucher_number AS "voucherNumber",
        vouchers.voucher_type AS "voucherType",
        vouchers.voucher_date AS "voucherDate",
        vouchers.approval_status AS "approvalStatus",
        vouchers.status,
        approved_by_user_id AS "approvedByUserId",
        COALESCE(NULLIF(BTRIM(ea.full_name), ''), NULLIF(BTRIM(ua.username), '')) AS "approvedByDisplayName",
        approved_at AS "approvedAt",
        GREATEST((CURRENT_DATE - DATE(COALESCE(approved_at, updated_at, created_at))), 0)::int AS "ageDays"
      FROM vouchers
      LEFT JOIN users ua ON ua.id = vouchers.approved_by_user_id
      LEFT JOIN employees ea ON ea.id = ua.employee_id
      WHERE vouchers.company_id = $1
        AND status = 'draft'
        AND approval_status = 'approved'
      ORDER BY COALESCE(vouchers.approved_at, vouchers.updated_at, vouchers.created_at) ASC, vouchers.id ASC
      LIMIT $2
      `,
      [companyId, normalizedLimit]
    ),
    db.query(
      `
      SELECT
        vouchers.id,
        vouchers.voucher_number AS "voucherNumber",
        vouchers.voucher_type AS "voucherType",
        vouchers.voucher_date AS "voucherDate",
        vouchers.approval_status AS "approvalStatus",
        vouchers.status,
        rejected_by_user_id AS "rejectedByUserId",
        COALESCE(NULLIF(BTRIM(er.full_name), ''), NULLIF(BTRIM(ur.username), '')) AS "rejectedByDisplayName",
        rejected_at AS "rejectedAt",
        narration,
        GREATEST((CURRENT_DATE - DATE(COALESCE(rejected_at, updated_at, created_at))), 0)::int AS "ageDays"
      FROM vouchers
      LEFT JOIN users ur ON ur.id = vouchers.rejected_by_user_id
      LEFT JOIN employees er ON er.id = ur.employee_id
      WHERE vouchers.company_id = $1
        AND status = 'draft'
        AND approval_status = 'rejected'
      ORDER BY COALESCE(vouchers.rejected_at, vouchers.updated_at, vouchers.created_at) DESC, vouchers.id DESC
      LIMIT $2
      `,
      [companyId, normalizedLimit]
    ),
    tableExists("finance_transition_logs", db)
      .then((exists) => {
        if (!exists) {
          return { rows: [] };
        }
        return db.query(
          `
          SELECT
            ftl.id,
            ftl.entity_type AS "entityType",
            ftl.entity_id AS "entityId",
            ftl.action,
            ftl.from_state AS "fromState",
            ftl.to_state AS "toState",
            ftl.performed_by_user_id AS "performedByUserId",
            COALESCE(NULLIF(BTRIM(e.full_name), ''), NULLIF(BTRIM(u.username), '')) AS "performedByDisplayName",
            ftl.remarks,
            ftl.created_at AS "createdAt"
          FROM finance_transition_logs ftl
          LEFT JOIN users u ON u.id = ftl.performed_by_user_id
          LEFT JOIN employees e ON e.id = u.employee_id
          WHERE ftl.company_id = $1
          ORDER BY ftl.id DESC
          LIMIT $2
          `,
          [companyId, normalizedLimit]
        );
      }),
  ]);

  const allQueuedItems = [...pendingRes.rows, ...postingRes.rows, ...rejectedRes.rows];
  const oldestPendingDays = allQueuedItems.reduce(
    (max, row) => Math.max(max, Number(row.ageDays || 0)),
    0
  );

  return {
    pendingSubmissions: pendingRes.rows,
    approvedForPosting: postingRes.rows,
    rejectedItems: rejectedRes.rows,
    recentActivity: recentRes.rows,
    backlogSummary: {
      totalPending: allQueuedItems.length,
      oldestPendingDays,
      ageingBreachedCount: allQueuedItems.filter((row) => Number(row.ageDays || 0) >= 3).length,
    },
  };
};

const listFinanceTransitionHistory = async ({
  companyId,
  entityType = "",
  entityId = null,
  action = "",
  performedByUserId = null,
  dateFrom = "",
  dateTo = "",
  limit = 100,
  page = 1,
  db = pool,
}) => {
  if (!(await tableExists("finance_transition_logs", db))) {
    return {
      items: [],
      total: 0,
      page: 1,
      limit: 0,
    };
  }

  const values = [companyId];
  const filters = ["ftl.company_id = $1"];

  if (entityType) {
    values.push(String(entityType).trim().toLowerCase());
    filters.push(`ftl.entity_type = $${values.length}`);
  }

  if (entityId) {
    values.push(Number(entityId));
    filters.push(`ftl.entity_id = $${values.length}`);
  }

  const safeAction = String(action || "").trim().toLowerCase();
  if (safeAction) {
    if (!FINANCE_TRANSITION_ACTIONS.has(safeAction)) {
      const error = new Error("Unsupported finance transition action filter");
      error.statusCode = 400;
      throw error;
    }
    values.push(safeAction);
    filters.push(`ftl.action = $${values.length}`);
  }

  const safeActorUserId = Number(performedByUserId || 0);
  if (safeActorUserId > 0) {
    values.push(safeActorUserId);
    filters.push(`ftl.performed_by_user_id = $${values.length}`);
  }

  const safeDateFrom = String(dateFrom || "").trim();
  if (safeDateFrom) {
    if (!ISO_DATE_PATTERN.test(safeDateFrom)) {
      const error = new Error("dateFrom must use YYYY-MM-DD format");
      error.statusCode = 400;
      throw error;
    }
    values.push(safeDateFrom);
    filters.push(`DATE(ftl.created_at) >= $${values.length}::date`);
  }

  const safeDateTo = String(dateTo || "").trim();
  if (safeDateTo) {
    if (!ISO_DATE_PATTERN.test(safeDateTo)) {
      const error = new Error("dateTo must use YYYY-MM-DD format");
      error.statusCode = 400;
      throw error;
    }
    values.push(safeDateTo);
    filters.push(`DATE(ftl.created_at) <= $${values.length}::date`);
  }

  if (safeDateFrom && safeDateTo && safeDateTo < safeDateFrom) {
    const error = new Error("dateTo cannot be earlier than dateFrom");
    error.statusCode = 400;
    throw error;
  }

  const normalizedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedLimit;

  const whereClause = `WHERE ${filters.join(" AND ")}`;
  const countValues = [...values];
  values.push(normalizedLimit);
  values.push(offset);

  const result = await db.query(
    `
    SELECT
      ftl.id,
      ftl.entity_type AS "entityType",
      ftl.entity_id AS "entityId",
      ftl.action,
      ftl.from_state AS "fromState",
      ftl.to_state AS "toState",
      ftl.performed_by_user_id AS "performedByUserId",
      COALESCE(NULLIF(BTRIM(e.full_name), ''), NULLIF(BTRIM(u.username), '')) AS "performedByDisplayName",
      ftl.remarks,
      ftl.metadata,
      ftl.created_at AS "createdAt"
    FROM finance_transition_logs ftl
    LEFT JOIN users u ON u.id = ftl.performed_by_user_id
    LEFT JOIN employees e ON e.id = u.employee_id
    ${whereClause}
    ORDER BY ftl.id DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
    `,
    values
  );

  const countResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM finance_transition_logs ftl
    ${whereClause}
    `,
    countValues
  );

  return {
    items: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const upsertFinanceSourceLink = async ({
  companyId,
  sourceModule,
  sourceRecordId,
  sourceEvent,
  postingRuleCode = null,
  voucherId = null,
  postingStatus = "pending",
  metadata = null,
  db = pool,
}) => {
  const normalizedSourceModule = normalizeSourceText(sourceModule);
  const normalizedSourceEvent = normalizeSourceText(sourceEvent);
  const normalizedSourceRecordId = Number(sourceRecordId || 0);

  if (!normalizedSourceModule || !normalizedSourceEvent || !Number.isInteger(normalizedSourceRecordId) || normalizedSourceRecordId <= 0) {
    const error = new Error("sourceModule, sourceEvent, and sourceRecordId are required for source linking");
    error.statusCode = 400;
    throw error;
  }

  const result = await db.query(
    `
    INSERT INTO finance_source_links (
      company_id,
      source_module,
      source_record_id,
      source_event,
      posting_rule_code,
      voucher_id,
      posting_status,
      metadata
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (company_id, source_module, source_record_id, source_event)
    DO UPDATE
    SET
      posting_rule_code = EXCLUDED.posting_rule_code,
      voucher_id = EXCLUDED.voucher_id,
      posting_status = EXCLUDED.posting_status,
      metadata = EXCLUDED.metadata,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      id,
      company_id AS "companyId",
      source_module AS "sourceModule",
      source_record_id AS "sourceRecordId",
      source_event AS "sourceEvent",
      posting_rule_code AS "postingRuleCode",
      voucher_id AS "voucherId",
      posting_status AS "postingStatus",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [
      companyId,
      normalizedSourceModule,
      normalizedSourceRecordId,
      normalizedSourceEvent,
      postingRuleCode,
      voucherId,
      postingStatus,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );

  return result.rows[0] || null;
};

const findPostingRule = async ({ companyId, sourceModule, eventName, db = pool }) => {
  const result = await db.query(
    `
    SELECT
      id,
      rule_code AS "ruleCode",
      event_name AS "eventName",
      source_module AS "sourceModule",
      voucher_type AS "voucherType",
      debit_account_id AS "debitAccountId",
      credit_account_id AS "creditAccountId",
      party_required AS "partyRequired",
      vendor_required AS "vendorRequired",
      requires_approval AS "requiresApproval",
      auto_post_enabled AS "autoPostEnabled",
      is_active AS "isActive",
      rule_priority AS "rulePriority"
    FROM finance_posting_rules
    WHERE company_id = $1
      AND source_module = $2
      AND event_name = $3
      AND is_active = TRUE
    ORDER BY rule_priority ASC, id ASC
    LIMIT 1
    `,
    [companyId, sourceModule, eventName]
  );

  return result.rows[0] || null;
};

module.exports = {
  VOUCHER_TYPES,
  ensureVoucherBalanced,
  deriveWorkflowState,
  getNextVoucherNumber,
  getVoucherById,
  getFinancePolicyControls,
  updateFinancePolicyControls,
  createVoucher,
  submitVoucher,
  approveVoucher,
  rejectVoucher,
  postVoucher,
  reverseVoucher,
  listVouchers,
  getWorkflowInbox,
  listFinanceTransitionHistory,
  appendFinanceTransitionLog,
  upsertFinanceSourceLink,
  findPostingRule,
};
