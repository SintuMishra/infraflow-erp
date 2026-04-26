const { pool } = require("../../config/db");
const {
  formatRowDateField,
} = require("../../utils/date.util");
const { hasColumn, tableExists } = require("../../utils/companyScope.util");

const toNumberOrNull = (value) =>
  value === null || value === undefined ? null : Number(value);

const formatDispatchRow = (row) => {
  if (!row) return null;

  let formatted = { ...row };
  ["dispatchDate", "ewbDate", "ewbValidUpto", "invoiceDate"].forEach((field) => {
    formatted = formatRowDateField(formatted, field);
  });

  return {
    ...formatted,
    quantityTons: toNumberOrNull(formatted.quantityTons),
    enteredQuantity: toNumberOrNull(formatted.enteredQuantity),
    enteredUnitId: toNumberOrNull(formatted.enteredUnitId),
    conversionFactorToTon: toNumberOrNull(formatted.conversionFactorToTon),
    conversionId: toNumberOrNull(formatted.conversionId),
    sourceVehicleCapacityTons: toNumberOrNull(formatted.sourceVehicleCapacityTons),
    sourceVehicleCapacityUnitId: toNumberOrNull(formatted.sourceVehicleCapacityUnitId),
    billingUnitIdSnapshot: toNumberOrNull(formatted.billingUnitIdSnapshot),
    billedQuantitySnapshot: toNumberOrNull(formatted.billedQuantitySnapshot),
    billedRateSnapshot: toNumberOrNull(formatted.billedRateSnapshot),
    transportUnitIdSnapshot: toNumberOrNull(formatted.transportUnitIdSnapshot),
    transportQuantitySnapshot: toNumberOrNull(formatted.transportQuantitySnapshot),
    invoiceValue: toNumberOrNull(formatted.invoiceValue),
    distanceKm: toNumberOrNull(formatted.distanceKm),
    materialRatePerTon: toNumberOrNull(formatted.materialRatePerTon),
    materialRateUnitsPerTon: toNumberOrNull(formatted.materialRateUnitsPerTon),
    royaltyTonsPerBrass: toNumberOrNull(formatted.royaltyTonsPerBrass),
    materialAmount: toNumberOrNull(formatted.materialAmount),
    transportRateValue: toNumberOrNull(formatted.transportRateValue),
    transportCost: toNumberOrNull(formatted.transportCost),
    royaltyValue: toNumberOrNull(formatted.royaltyValue),
    royaltyAmount: toNumberOrNull(formatted.royaltyAmount),
    loadingCharge: toNumberOrNull(formatted.loadingCharge),
    loadingChargeRate: toNumberOrNull(formatted.loadingChargeRate),
    otherCharge: toNumberOrNull(formatted.otherCharge),
    totalInvoiceValue: toNumberOrNull(formatted.totalInvoiceValue),
    gstRate: toNumberOrNull(formatted.gstRate),
    cgst: toNumberOrNull(formatted.cgst),
    sgst: toNumberOrNull(formatted.sgst),
    igst: toNumberOrNull(formatted.igst),
    totalWithGst: toNumberOrNull(formatted.totalWithGst),
  };
};

const getDispatchSchemaCapabilities = async (db = pool) => {
  const [
    dispatchHasCompany,
    dispatchHasPartyOrder,
    hasPartyOrdersTable,
    materialHasHsnSac,
    hasFinanceStatus,
    hasCanPostToFinance,
    hasFinancePostingState,
    hasFinanceSourceLinkId,
    hasFinanceLastVoucherId,
    hasFinanceNotes,
    hasMaterialRateUnit,
    hasMaterialRateUnitLabel,
    hasMaterialRateUnitsPerTon,
    hasRoyaltyTonsPerBrass,
    hasLoadingChargeBasis,
    hasLoadingChargeRate,
    hasLoadingChargeIsManual,
    hasEnteredQuantity,
    hasEnteredUnitId,
    hasQuantitySource,
    hasConversionFactorToTon,
    hasConversionId,
    hasConversionMethodSnapshot,
    hasSourceVehicleCapacityTons,
    hasSourceVehicleCapacityUnitId,
    hasBillingBasisSnapshot,
    hasBillingUnitIdSnapshot,
    hasBilledQuantitySnapshot,
    hasBilledRateSnapshot,
    hasTransportBasisSnapshot,
    hasTransportUnitIdSnapshot,
    hasTransportQuantitySnapshot,
    hasConversionNotesSnapshot,
  ] = await Promise.all([
    hasColumn("dispatch_reports", "company_id", db),
    hasColumn("dispatch_reports", "party_order_id", db),
    tableExists("party_orders", db),
    hasColumn("material_master", "hsn_sac_code", db),
    hasColumn("dispatch_reports", "finance_status", db),
    hasColumn("dispatch_reports", "can_post_to_finance", db),
    hasColumn("dispatch_reports", "finance_posting_state", db),
    hasColumn("dispatch_reports", "finance_source_link_id", db),
    hasColumn("dispatch_reports", "finance_last_voucher_id", db),
    hasColumn("dispatch_reports", "finance_notes", db),
    hasColumn("dispatch_reports", "material_rate_unit", db),
    hasColumn("dispatch_reports", "material_rate_unit_label", db),
    hasColumn("dispatch_reports", "material_rate_units_per_ton", db),
    hasColumn("dispatch_reports", "royalty_tons_per_brass", db),
    hasColumn("dispatch_reports", "loading_charge_basis", db),
    hasColumn("dispatch_reports", "loading_charge_rate", db),
    hasColumn("dispatch_reports", "loading_charge_is_manual", db),
    hasColumn("dispatch_reports", "entered_quantity", db),
    hasColumn("dispatch_reports", "entered_unit_id", db),
    hasColumn("dispatch_reports", "quantity_source", db),
    hasColumn("dispatch_reports", "conversion_factor_to_ton", db),
    hasColumn("dispatch_reports", "conversion_id", db),
    hasColumn("dispatch_reports", "conversion_method_snapshot", db),
    hasColumn("dispatch_reports", "source_vehicle_capacity_tons", db),
    hasColumn("dispatch_reports", "source_vehicle_capacity_unit_id", db),
    hasColumn("dispatch_reports", "billing_basis_snapshot", db),
    hasColumn("dispatch_reports", "billing_unit_id_snapshot", db),
    hasColumn("dispatch_reports", "billed_quantity_snapshot", db),
    hasColumn("dispatch_reports", "billed_rate_snapshot", db),
    hasColumn("dispatch_reports", "transport_basis_snapshot", db),
    hasColumn("dispatch_reports", "transport_unit_id_snapshot", db),
    hasColumn("dispatch_reports", "transport_quantity_snapshot", db),
    hasColumn("dispatch_reports", "conversion_notes_snapshot", db),
  ]);

  return {
    dispatchHasCompany,
    dispatchHasPartyOrder,
    hasPartyOrdersTable,
    materialHasHsnSac,
    includePartyOrder: hasPartyOrdersTable && dispatchHasPartyOrder,
    hasFinanceStatus,
    hasCanPostToFinance,
    hasFinancePostingState,
    hasFinanceSourceLinkId,
    hasFinanceLastVoucherId,
    hasFinanceNotes,
    hasMaterialRateUnit,
    hasMaterialRateUnitLabel,
    hasMaterialRateUnitsPerTon,
    hasRoyaltyTonsPerBrass,
    hasLoadingChargeBasis,
    hasLoadingChargeRate,
    hasLoadingChargeIsManual,
    hasEnteredQuantity,
    hasEnteredUnitId,
    hasQuantitySource,
    hasConversionFactorToTon,
    hasConversionId,
    hasConversionMethodSnapshot,
    hasSourceVehicleCapacityTons,
    hasSourceVehicleCapacityUnitId,
    hasBillingBasisSnapshot,
    hasBillingUnitIdSnapshot,
    hasBilledQuantitySnapshot,
    hasBilledRateSnapshot,
    hasTransportBasisSnapshot,
    hasTransportUnitIdSnapshot,
    hasTransportQuantitySnapshot,
    hasConversionNotesSnapshot,
  };
};

const buildDispatchFilters = async ({
  companyId = null,
  search = "",
  plantId = null,
  partyId = null,
  materialId = null,
  linkedOrderFilter = "",
  sourceType = "",
  status = "",
  dateFrom = "",
  dateTo = "",
} = {}, db = pool, schemaCapabilities = null) => {
  const capabilities =
    schemaCapabilities || (await getDispatchSchemaCapabilities(db));
  const { dispatchHasCompany, dispatchHasPartyOrder, materialHasHsnSac } = capabilities;
  const values = [];
  const conditions = [];
  let parameterIndex = 1;

  if (dispatchHasCompany && companyId !== null) {
    values.push(companyId);
    conditions.push(`dr.company_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (plantId !== null && plantId !== undefined && plantId !== "") {
    values.push(Number(plantId));
    conditions.push(`dr.plant_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (partyId !== null && partyId !== undefined && partyId !== "") {
    values.push(Number(partyId));
    conditions.push(`dr.party_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (materialId !== null && materialId !== undefined && materialId !== "") {
    values.push(Number(materialId));
    conditions.push(`dr.material_id = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (dispatchHasPartyOrder && linkedOrderFilter === "linked") {
    conditions.push(`dr.party_order_id IS NOT NULL`);
  }

  if (dispatchHasPartyOrder && linkedOrderFilter === "unlinked") {
    conditions.push(`dr.party_order_id IS NULL`);
  }

  if (sourceType) {
    values.push(sourceType);
    conditions.push(`dr.source_type = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (status) {
    values.push(status);
    conditions.push(`dr.status = $${parameterIndex}`);
    parameterIndex += 1;
  }

  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`dr.dispatch_date >= $${parameterIndex}::date`);
    parameterIndex += 1;
  }

  if (dateTo) {
    values.push(dateTo);
    conditions.push(`dr.dispatch_date <= $${parameterIndex}::date`);
    parameterIndex += 1;
  }

  if (search) {
    values.push(`%${String(search).trim().toLowerCase()}%`);
    const searchParam = `$${parameterIndex}`;
    const searchColumns = [
      "LOWER(COALESCE(pm.plant_name, ''))",
      "LOWER(COALESCE(mm.material_name, ''))",
      "LOWER(COALESCE(v.vehicle_number, ''))",
      "LOWER(COALESCE(dr.vehicle_number, ''))",
      "LOWER(COALESCE(dr.destination_name, ''))",
      "LOWER(COALESCE(p.party_name, ''))",
      "LOWER(COALESCE(transport_vendor.vendor_name, ''))",
      "LOWER(COALESCE(dr.remarks, ''))",
      "LOWER(COALESCE(dr.ewb_number, ''))",
      "LOWER(COALESCE(dr.invoice_number, ''))",
      "LOWER(COALESCE(dr.source_name, ''))",
      "LOWER(COALESCE(dr.material_type, ''))",
    ];

    if (materialHasHsnSac) {
      searchColumns.push("LOWER(COALESCE(mm.hsn_sac_code, ''))");
    }

    if (dispatchHasPartyOrder) {
      searchColumns.push("LOWER(COALESCE(po.order_number, ''))");
    }

    conditions.push(
      `(${searchColumns.map((column) => `${column} LIKE ${searchParam}`).join(" OR ")})`
    );
    parameterIndex += 1;
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const buildBaseDispatchSelect = async (db = pool, schemaCapabilities = null) => {
  const capabilities =
    schemaCapabilities || (await getDispatchSchemaCapabilities(db));
  const {
    includePartyOrder,
    materialHasHsnSac,
    hasFinanceStatus,
    hasCanPostToFinance,
    hasFinancePostingState,
    hasFinanceSourceLinkId,
    hasFinanceLastVoucherId,
    hasFinanceNotes,
    hasMaterialRateUnit,
    hasMaterialRateUnitLabel,
    hasMaterialRateUnitsPerTon,
    hasRoyaltyTonsPerBrass,
    hasLoadingChargeBasis,
    hasLoadingChargeRate,
    hasLoadingChargeIsManual,
    hasEnteredQuantity,
    hasEnteredUnitId,
    hasQuantitySource,
    hasConversionFactorToTon,
    hasConversionId,
    hasConversionMethodSnapshot,
    hasSourceVehicleCapacityTons,
    hasSourceVehicleCapacityUnitId,
    hasBillingBasisSnapshot,
    hasBillingUnitIdSnapshot,
    hasBilledQuantitySnapshot,
    hasBilledRateSnapshot,
    hasTransportBasisSnapshot,
    hasTransportUnitIdSnapshot,
    hasTransportQuantitySnapshot,
    hasConversionNotesSnapshot,
  } = capabilities;

  return `
    SELECT
      dr.id,
      dr.dispatch_date AS "dispatchDate",
      dr.source_type AS "sourceType",
      dr.source_name AS "sourceName",
      dr.material_type AS "materialType",
      dr.vehicle_number AS "vehicleNumber",
      dr.destination_name AS "destinationName",
      dr.quantity_tons AS "quantityTons",
      ${hasEnteredQuantity ? `dr.entered_quantity AS "enteredQuantity",` : `NULL AS "enteredQuantity",`}
      ${hasEnteredUnitId ? `dr.entered_unit_id AS "enteredUnitId",` : `NULL AS "enteredUnitId",`}
      ${hasQuantitySource ? `dr.quantity_source AS "quantitySource",` : `NULL AS "quantitySource",`}
      ${hasConversionFactorToTon ? `dr.conversion_factor_to_ton AS "conversionFactorToTon",` : `NULL AS "conversionFactorToTon",`}
      ${hasConversionId ? `dr.conversion_id AS "conversionId",` : `NULL AS "conversionId",`}
      ${hasConversionMethodSnapshot ? `dr.conversion_method_snapshot AS "conversionMethodSnapshot",` : `NULL AS "conversionMethodSnapshot",`}
      ${hasSourceVehicleCapacityTons ? `dr.source_vehicle_capacity_tons AS "sourceVehicleCapacityTons",` : `NULL AS "sourceVehicleCapacityTons",`}
      ${hasSourceVehicleCapacityUnitId ? `dr.source_vehicle_capacity_unit_id AS "sourceVehicleCapacityUnitId",` : `NULL AS "sourceVehicleCapacityUnitId",`}
      ${hasBillingBasisSnapshot ? `dr.billing_basis_snapshot AS "billingBasisSnapshot",` : `NULL AS "billingBasisSnapshot",`}
      ${hasBillingUnitIdSnapshot ? `dr.billing_unit_id_snapshot AS "billingUnitIdSnapshot",` : `NULL AS "billingUnitIdSnapshot",`}
      ${hasBilledQuantitySnapshot ? `dr.billed_quantity_snapshot AS "billedQuantitySnapshot",` : `NULL AS "billedQuantitySnapshot",`}
      ${hasBilledRateSnapshot ? `dr.billed_rate_snapshot AS "billedRateSnapshot",` : `NULL AS "billedRateSnapshot",`}
      ${hasTransportBasisSnapshot ? `dr.transport_basis_snapshot AS "transportBasisSnapshot",` : `NULL AS "transportBasisSnapshot",`}
      ${hasTransportUnitIdSnapshot ? `dr.transport_unit_id_snapshot AS "transportUnitIdSnapshot",` : `NULL AS "transportUnitIdSnapshot",`}
      ${hasTransportQuantitySnapshot ? `dr.transport_quantity_snapshot AS "transportQuantitySnapshot",` : `NULL AS "transportQuantitySnapshot",`}
      ${hasConversionNotesSnapshot ? `dr.conversion_notes_snapshot AS "conversionNotesSnapshot",` : `NULL AS "conversionNotesSnapshot",`}
      dr.remarks,
      dr.status,
      dr.ewb_number AS "ewbNumber",
      dr.ewb_date AS "ewbDate",
      dr.ewb_valid_upto AS "ewbValidUpto",
      dr.invoice_number AS "invoiceNumber",
      dr.invoice_date AS "invoiceDate",
      dr.invoice_value AS "invoiceValue",
      dr.distance_km AS "distanceKm",
      dr.created_by AS "createdBy",
      dr.created_at AS "createdAt",
      dr.updated_at AS "updatedAt",

      dr.plant_id AS "plantId",
      dr.material_id AS "materialId",
      dr.vehicle_id AS "vehicleId",
      dr.party_id AS "partyId",
      dr.transport_vendor_id AS "transportVendorId",
      dr.party_material_rate_id AS "partyMaterialRateId",
      dr.transport_rate_id AS "transportRateId",
      ${
        includePartyOrder
          ? `
      dr.party_order_id AS "partyOrderId",
      po.order_number AS "partyOrderNumber",
      po.order_date AS "partyOrderDate",
      `
          : `
      NULL AS "partyOrderId",
      NULL AS "partyOrderNumber",
      NULL AS "partyOrderDate",
      `
      }

      dr.material_rate_per_ton AS "materialRatePerTon",
      ${hasMaterialRateUnit ? `dr.material_rate_unit AS "materialRateUnit",` : `'per_ton' AS "materialRateUnit",`}
      ${hasMaterialRateUnitLabel ? `dr.material_rate_unit_label AS "materialRateUnitLabel",` : `'ton' AS "materialRateUnitLabel",`}
      ${hasMaterialRateUnitsPerTon ? `dr.material_rate_units_per_ton AS "materialRateUnitsPerTon",` : `1 AS "materialRateUnitsPerTon",`}
      dr.material_amount AS "materialAmount",
      dr.transport_rate_type AS "transportRateType",
      dr.transport_rate_value AS "transportRateValue",
      dr.transport_cost AS "transportCost",
      dr.royalty_mode AS "royaltyMode",
      dr.royalty_value AS "royaltyValue",
      ${hasRoyaltyTonsPerBrass ? `dr.royalty_tons_per_brass AS "royaltyTonsPerBrass",` : `NULL AS "royaltyTonsPerBrass",`}
      dr.royalty_amount AS "royaltyAmount",
      dr.loading_charge AS "loadingCharge",
      ${hasLoadingChargeBasis ? `dr.loading_charge_basis AS "loadingChargeBasis",` : `'fixed' AS "loadingChargeBasis",`}
      ${hasLoadingChargeRate ? `dr.loading_charge_rate AS "loadingChargeRate",` : `dr.loading_charge AS "loadingChargeRate",`}
      ${hasLoadingChargeIsManual ? `dr.loading_charge_is_manual AS "loadingChargeIsManual",` : `FALSE AS "loadingChargeIsManual",`}
      dr.other_charge AS "otherCharge",
      dr.total_invoice_value AS "totalInvoiceValue",
      dr.billing_notes AS "billingNotes",
      dr.gst_rate AS "gstRate",
      dr.cgst AS "cgst",
      dr.sgst AS "sgst",
      dr.igst AS "igst",
      dr.total_with_gst AS "totalWithGst",
      ${hasFinanceStatus ? `dr.finance_status AS "financeStatus",` : `NULL AS "financeStatus",`}
      ${hasCanPostToFinance ? `dr.can_post_to_finance AS "canPostToFinance",` : `FALSE AS "canPostToFinance",`}
      ${hasFinancePostingState ? `dr.finance_posting_state AS "financePostingState",` : `NULL AS "financePostingState",`}
      ${hasFinanceSourceLinkId ? `dr.finance_source_link_id AS "financeSourceLinkId",` : `NULL AS "financeSourceLinkId",`}
      ${hasFinanceLastVoucherId ? `dr.finance_last_voucher_id AS "financeLastVoucherId",` : `NULL AS "financeLastVoucherId",`}
      ${hasFinanceNotes ? `dr.finance_notes AS "financeNotes",` : `NULL AS "financeNotes",`}

      pm.plant_name AS "plantName",
      pm.plant_type AS "plantType",

      mm.material_name AS "materialName",
      mm.material_code AS "materialCode",
      ${materialHasHsnSac ? `mm.hsn_sac_code AS "hsnSacCode",` : `NULL AS "hsnSacCode",`}

      v.vehicle_number AS "linkedVehicleNumber",
      v.vehicle_type AS "vehicleType",
      v.assigned_driver AS "assignedDriver",
      v.ownership_type AS "ownershipType",

      transport_vendor.vendor_name AS "transportVendorName",

      p.party_name AS "partyName",
      p.gstin AS "partyGstin",
      p.address_line1 AS "partyAddressLine1",
      p.address_line2 AS "partyAddressLine2",
      p.city AS "partyCity",
      p.state_name AS "partyStateName",
      p.state_code AS "partyStateCode"
    FROM dispatch_reports dr
    LEFT JOIN plant_master pm ON pm.id = dr.plant_id
    LEFT JOIN material_master mm ON mm.id = dr.material_id
    LEFT JOIN vehicles v ON v.id = dr.vehicle_id
    LEFT JOIN vendor_master transport_vendor ON transport_vendor.id = dr.transport_vendor_id
    LEFT JOIN party_master p ON p.id = dr.party_id
    ${includePartyOrder ? `LEFT JOIN party_orders po ON po.id = dr.party_order_id` : ""}
  `;
};

const findAllDispatchReports = async (filters = {}) => {
  const normalizedLimit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
  const normalizedPage = Math.max(Number(filters.page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedLimit;
  const schemaCapabilities = await getDispatchSchemaCapabilities();
  const baseDispatchSelect = await buildBaseDispatchSelect(pool, schemaCapabilities);
  const { whereClause, values } = await buildDispatchFilters(filters, pool, schemaCapabilities);
  const queryValues = [...values, normalizedLimit, offset];
  const limitParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;
  const query = `
    ${baseDispatchSelect}
    ${whereClause}
    ORDER BY dr.dispatch_date DESC, dr.id DESC
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM dispatch_reports dr
    LEFT JOIN plant_master pm ON pm.id = dr.plant_id
    LEFT JOIN material_master mm ON mm.id = dr.material_id
    LEFT JOIN vehicles v ON v.id = dr.vehicle_id
    LEFT JOIN vendor_master transport_vendor ON transport_vendor.id = dr.transport_vendor_id
    LEFT JOIN party_master p ON p.id = dr.party_id
    ${schemaCapabilities.includePartyOrder ? `LEFT JOIN party_orders po ON po.id = dr.party_order_id` : ""}
    ${whereClause}
  `;

  const [result, countResult] = await Promise.all([
    pool.query(query, queryValues),
    pool.query(countQuery, values),
  ]);

  return {
    items: result.rows.map(formatDispatchRow),
    total: countResult.rows[0]?.total || 0,
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const findDispatchReportSummary = async (filters = {}) => {
  const schemaCapabilities = await getDispatchSchemaCapabilities();
  const { dispatchHasPartyOrder, includePartyOrder } = schemaCapabilities;
  const { whereClause, values } = await buildDispatchFilters(filters, pool, schemaCapabilities);
  const result = await pool.query(
    `
    SELECT
      COUNT(*)::int AS "totalDispatches",
      COALESCE(SUM(dr.quantity_tons), 0)::numeric AS "totalQuantity",
      COALESCE(SUM(COALESCE(dr.total_invoice_value, dr.invoice_value)), 0)::numeric AS "totalInvoiceValue",
      COUNT(*) FILTER (WHERE dr.status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE dr.status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE dr.status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (
        WHERE ${dispatchHasPartyOrder ? "dr.party_order_id IS NOT NULL" : "FALSE"}
      )::int AS "linkedOrders",
      COUNT(*) FILTER (
        WHERE ${dispatchHasPartyOrder ? "dr.party_order_id IS NULL" : "TRUE"}
      )::int AS "unlinkedOrders",
      COUNT(DISTINCT dr.plant_id)::int AS "uniquePlants",
      COUNT(DISTINCT dr.party_id)::int AS "uniqueParties",
      COUNT(DISTINCT dr.material_id)::int AS "uniqueMaterials",
      MAX(dr.dispatch_date) AS "latestDispatchDate"
    FROM dispatch_reports dr
    LEFT JOIN plant_master pm ON pm.id = dr.plant_id
    LEFT JOIN material_master mm ON mm.id = dr.material_id
    LEFT JOIN vehicles v ON v.id = dr.vehicle_id
    LEFT JOIN vendor_master transport_vendor ON transport_vendor.id = dr.transport_vendor_id
    LEFT JOIN party_master p ON p.id = dr.party_id
    ${includePartyOrder ? `LEFT JOIN party_orders po ON po.id = dr.party_order_id` : ""}
    ${whereClause}
    `,
    values
  );

  return result.rows[0] || null;
};

const findDispatchById = async (reportId, db = pool, companyId = null) => {
  const schemaCapabilities = await getDispatchSchemaCapabilities(db);
  const { dispatchHasCompany } = schemaCapabilities;
  const baseDispatchSelect = await buildBaseDispatchSelect(db, schemaCapabilities);
  const query = `
    ${baseDispatchSelect}
    WHERE dr.id = $1
    ${dispatchHasCompany && companyId !== null ? `AND dr.company_id = $2` : ""}
  `;

  const result = await db.query(
    query,
    dispatchHasCompany && companyId !== null ? [reportId, companyId] : [reportId]
  );
  return result.rows[0] ? formatDispatchRow(result.rows[0]) : null;
};

const insertDispatchReport = async ({
  dispatchDate,
  sourceType,
  sourceName,
  materialType,
  vehicleNumber,
  destinationName,
  quantityTons,
  enteredQuantity,
  enteredUnitId,
  quantitySource,
  conversionFactorToTon,
  conversionId,
  conversionMethodSnapshot,
  sourceVehicleCapacityTons,
  sourceVehicleCapacityUnitId,
  billingBasisSnapshot,
  billingUnitIdSnapshot,
  billedQuantitySnapshot,
  billedRateSnapshot,
  transportBasisSnapshot,
  transportUnitIdSnapshot,
  transportQuantitySnapshot,
  conversionNotesSnapshot,
  remarks,
  createdBy,
  plantId,
  materialId,
  vehicleId,
  status,
  ewbNumber,
  ewbDate,
  ewbValidUpto,
  invoiceNumber,
  invoiceDate,
  invoiceValue,
  distanceKm,
  partyId,
  transportVendorId,
  partyMaterialRateId,
  transportRateId,
  partyOrderId,
  materialRatePerTon,
  materialRateUnit,
  materialRateUnitLabel,
  materialRateUnitsPerTon,
  materialAmount,
  transportRateType,
  transportRateValue,
  transportCost,
  royaltyMode,
  royaltyValue,
  royaltyTonsPerBrass,
  royaltyAmount,
  loadingCharge,
  loadingChargeBasis,
  loadingChargeRate,
  loadingChargeIsManual,
  otherCharge,
  totalInvoiceValue,
  billingNotes,
  gstRate,
  cgst,
  sgst,
  igst,
  totalWithGst,
  companyId,
}, db = pool) => {
  const dispatchHasCompany = await hasColumn("dispatch_reports", "company_id", db);
  const dispatchHasPartyOrder = await hasColumn("dispatch_reports", "party_order_id", db);
  const hasMaterialRateUnit = await hasColumn("dispatch_reports", "material_rate_unit", db);
  const hasMaterialRateUnitLabel = await hasColumn("dispatch_reports", "material_rate_unit_label", db);
  const hasMaterialRateUnitsPerTon = await hasColumn("dispatch_reports", "material_rate_units_per_ton", db);
  const hasRoyaltyTonsPerBrass = await hasColumn("dispatch_reports", "royalty_tons_per_brass", db);
  const hasLoadingChargeBasis = await hasColumn("dispatch_reports", "loading_charge_basis", db);
  const hasLoadingChargeRate = await hasColumn("dispatch_reports", "loading_charge_rate", db);
  const hasLoadingChargeIsManual = await hasColumn("dispatch_reports", "loading_charge_is_manual", db);
  const hasEnteredQuantity = await hasColumn("dispatch_reports", "entered_quantity", db);
  const hasEnteredUnitId = await hasColumn("dispatch_reports", "entered_unit_id", db);
  const hasQuantitySource = await hasColumn("dispatch_reports", "quantity_source", db);
  const hasConversionFactorToTon = await hasColumn("dispatch_reports", "conversion_factor_to_ton", db);
  const hasConversionId = await hasColumn("dispatch_reports", "conversion_id", db);
  const hasConversionMethodSnapshot = await hasColumn("dispatch_reports", "conversion_method_snapshot", db);
  const hasSourceVehicleCapacityTons = await hasColumn("dispatch_reports", "source_vehicle_capacity_tons", db);
  const hasSourceVehicleCapacityUnitId = await hasColumn("dispatch_reports", "source_vehicle_capacity_unit_id", db);
  const hasBillingBasisSnapshot = await hasColumn("dispatch_reports", "billing_basis_snapshot", db);
  const hasBillingUnitIdSnapshot = await hasColumn("dispatch_reports", "billing_unit_id_snapshot", db);
  const hasBilledQuantitySnapshot = await hasColumn("dispatch_reports", "billed_quantity_snapshot", db);
  const hasBilledRateSnapshot = await hasColumn("dispatch_reports", "billed_rate_snapshot", db);
  const hasTransportBasisSnapshot = await hasColumn("dispatch_reports", "transport_basis_snapshot", db);
  const hasTransportUnitIdSnapshot = await hasColumn("dispatch_reports", "transport_unit_id_snapshot", db);
  const hasTransportQuantitySnapshot = await hasColumn("dispatch_reports", "transport_quantity_snapshot", db);
  const hasConversionNotesSnapshot = await hasColumn("dispatch_reports", "conversion_notes_snapshot", db);
  const optionalQuantityColumns = [
    hasEnteredQuantity ? "entered_quantity" : null,
    hasEnteredUnitId ? "entered_unit_id" : null,
    hasQuantitySource ? "quantity_source" : null,
    hasConversionFactorToTon ? "conversion_factor_to_ton" : null,
    hasConversionId ? "conversion_id" : null,
    hasConversionMethodSnapshot ? "conversion_method_snapshot" : null,
    hasSourceVehicleCapacityTons ? "source_vehicle_capacity_tons" : null,
    hasSourceVehicleCapacityUnitId ? "source_vehicle_capacity_unit_id" : null,
  ].filter(Boolean);
  const optionalQuantityValues = [
    ...(hasEnteredQuantity ? [enteredQuantity ?? null] : []),
    ...(hasEnteredUnitId ? [enteredUnitId ?? null] : []),
    ...(hasQuantitySource ? [quantitySource || null] : []),
    ...(hasConversionFactorToTon ? [conversionFactorToTon ?? null] : []),
    ...(hasConversionId ? [conversionId ?? null] : []),
    ...(hasConversionMethodSnapshot ? [conversionMethodSnapshot || null] : []),
    ...(hasSourceVehicleCapacityTons ? [sourceVehicleCapacityTons ?? null] : []),
    ...(hasSourceVehicleCapacityUnitId ? [sourceVehicleCapacityUnitId ?? null] : []),
  ];
  const optionalRateUnitColumns = [
    hasMaterialRateUnit ? "material_rate_unit" : null,
    hasMaterialRateUnitLabel ? "material_rate_unit_label" : null,
    hasMaterialRateUnitsPerTon ? "material_rate_units_per_ton" : null,
  ].filter(Boolean);
  const optionalRoyaltyColumns = [
    hasRoyaltyTonsPerBrass ? "royalty_tons_per_brass" : null,
  ].filter(Boolean);
  const optionalLoadingColumns = [
    hasLoadingChargeBasis ? "loading_charge_basis" : null,
    hasLoadingChargeRate ? "loading_charge_rate" : null,
    hasLoadingChargeIsManual ? "loading_charge_is_manual" : null,
  ].filter(Boolean);
  const optionalRateUnitValues = [
    ...(hasMaterialRateUnit ? [materialRateUnit || "per_ton"] : []),
    ...(hasMaterialRateUnitLabel ? [materialRateUnitLabel || "ton"] : []),
    ...(hasMaterialRateUnitsPerTon ? [materialRateUnitsPerTon ?? 1] : []),
  ];
  const optionalRoyaltyValues = [
    ...(hasRoyaltyTonsPerBrass ? [royaltyTonsPerBrass ?? null] : []),
  ];
  const optionalLoadingValues = [
    ...(hasLoadingChargeBasis ? [loadingChargeBasis || "fixed"] : []),
    ...(hasLoadingChargeRate ? [loadingChargeRate ?? loadingCharge ?? null] : []),
    ...(hasLoadingChargeIsManual ? [Boolean(loadingChargeIsManual)] : []),
  ];
  const optionalBillingSnapshotColumns = [
    hasBillingBasisSnapshot ? "billing_basis_snapshot" : null,
    hasBillingUnitIdSnapshot ? "billing_unit_id_snapshot" : null,
    hasBilledQuantitySnapshot ? "billed_quantity_snapshot" : null,
    hasBilledRateSnapshot ? "billed_rate_snapshot" : null,
    hasTransportBasisSnapshot ? "transport_basis_snapshot" : null,
    hasTransportUnitIdSnapshot ? "transport_unit_id_snapshot" : null,
    hasTransportQuantitySnapshot ? "transport_quantity_snapshot" : null,
    hasConversionNotesSnapshot ? "conversion_notes_snapshot" : null,
  ].filter(Boolean);
  const optionalBillingSnapshotValues = [
    ...(hasBillingBasisSnapshot ? [billingBasisSnapshot || null] : []),
    ...(hasBillingUnitIdSnapshot ? [billingUnitIdSnapshot ?? null] : []),
    ...(hasBilledQuantitySnapshot ? [billedQuantitySnapshot ?? null] : []),
    ...(hasBilledRateSnapshot ? [billedRateSnapshot ?? null] : []),
    ...(hasTransportBasisSnapshot ? [transportBasisSnapshot || null] : []),
    ...(hasTransportUnitIdSnapshot ? [transportUnitIdSnapshot ?? null] : []),
    ...(hasTransportQuantitySnapshot ? [transportQuantitySnapshot ?? null] : []),
    ...(hasConversionNotesSnapshot ? [conversionNotesSnapshot || null] : []),
  ];
  const quantityStartIndex = dispatchHasPartyOrder ? 27 : 26;
  const quantityPlaceholders = optionalQuantityValues.map((_, index) => `$${quantityStartIndex + index}`);
  const billingSnapshotStartIndex = quantityStartIndex + optionalQuantityValues.length;
  const billingSnapshotPlaceholders = optionalBillingSnapshotValues.map((_, index) => `$${billingSnapshotStartIndex + index}`);
  const rateUnitStartIndex = billingSnapshotStartIndex + optionalBillingSnapshotValues.length;
  const rateUnitPlaceholders = optionalRateUnitValues.map((_, index) => `$${rateUnitStartIndex + index}`);
  const royaltyStartIndex = rateUnitStartIndex + optionalRateUnitValues.length;
  const royaltyPlaceholders = optionalRoyaltyValues.map((_, index) => `$${royaltyStartIndex + index}`);
  const loadingStartIndex = royaltyStartIndex + optionalRoyaltyValues.length;
  const loadingPlaceholders = optionalLoadingValues.map((_, index) => `$${loadingStartIndex + index}`);
  const offset =
    optionalQuantityValues.length +
    optionalBillingSnapshotValues.length +
    optionalRateUnitValues.length +
    optionalRoyaltyValues.length +
    optionalLoadingValues.length;
  const query = `
    INSERT INTO dispatch_reports (
      dispatch_date,
      source_type,
      source_name,
      material_type,
      vehicle_number,
      destination_name,
      quantity_tons,
      remarks,
      created_by,
      plant_id,
      material_id,
      vehicle_id,
      status,
      ewb_number,
      ewb_date,
      ewb_valid_upto,
      invoice_number,
      invoice_date,
      invoice_value,
      distance_km,
      party_id,
      transport_vendor_id,
      party_material_rate_id,
      transport_rate_id,
      ${dispatchHasPartyOrder ? `party_order_id,` : ""}
      material_rate_per_ton,
      ${optionalQuantityColumns.length ? `${optionalQuantityColumns.join(",\n      ")},` : ""}
      ${optionalBillingSnapshotColumns.length ? `${optionalBillingSnapshotColumns.join(",\n      ")},` : ""}
      ${optionalRateUnitColumns.length ? `${optionalRateUnitColumns.join(",\n      ")},` : ""}
      ${optionalRoyaltyColumns.length ? `${optionalRoyaltyColumns.join(",\n      ")},` : ""}
      ${optionalLoadingColumns.length ? `${optionalLoadingColumns.join(",\n      ")},` : ""}
      material_amount,
      transport_rate_type,
      transport_rate_value,
      transport_cost,
      royalty_mode,
      royalty_value,
      royalty_amount,
      loading_charge,
      other_charge,
      total_invoice_value,
      billing_notes,
      gst_rate,
      cgst,
      sgst,
      igst,
      total_with_gst
      ${dispatchHasCompany ? `, company_id` : ""}
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24
      ${dispatchHasPartyOrder ? `, $25` : ""}
      , $${dispatchHasPartyOrder ? 26 : 25}
      ${quantityPlaceholders.length ? `, ${quantityPlaceholders.join(", ")}` : ""}
      ${billingSnapshotPlaceholders.length ? `, ${billingSnapshotPlaceholders.join(", ")}` : ""}
      ${rateUnitPlaceholders.length ? `, ${rateUnitPlaceholders.join(", ")}` : ""}
      ${royaltyPlaceholders.length ? `, ${royaltyPlaceholders.join(", ")}` : ""}
      ${loadingPlaceholders.length ? `, ${loadingPlaceholders.join(", ")}` : ""}
      , $${(dispatchHasPartyOrder ? 27 : 26) + offset}, $${(dispatchHasPartyOrder ? 28 : 27) + offset}, $${(dispatchHasPartyOrder ? 29 : 28) + offset}, $${(dispatchHasPartyOrder ? 30 : 29) + offset}, $${(dispatchHasPartyOrder ? 31 : 30) + offset}, $${(dispatchHasPartyOrder ? 32 : 31) + offset}, $${(dispatchHasPartyOrder ? 33 : 32) + offset}, $${(dispatchHasPartyOrder ? 34 : 33) + offset}, $${(dispatchHasPartyOrder ? 35 : 34) + offset},
      $${(dispatchHasPartyOrder ? 36 : 35) + offset}, $${(dispatchHasPartyOrder ? 37 : 36) + offset}, $${(dispatchHasPartyOrder ? 38 : 37) + offset}, $${(dispatchHasPartyOrder ? 39 : 38) + offset}, $${(dispatchHasPartyOrder ? 40 : 39) + offset}, $${(dispatchHasPartyOrder ? 41 : 40) + offset}, $${(dispatchHasPartyOrder ? 42 : 41) + offset}
      ${dispatchHasCompany ? `, $${(dispatchHasPartyOrder ? 43 : 42) + offset}` : ""}
    )
    RETURNING id
  `;

  const values = [
    dispatchDate,
    sourceType,
    sourceName,
    materialType,
    vehicleNumber,
    destinationName,
    quantityTons,
    remarks || null,
    createdBy || null,
    plantId || null,
    materialId || null,
    vehicleId || null,
    status || "pending",
    ewbNumber || null,
    ewbDate || null,
    ewbValidUpto || null,
    invoiceNumber || null,
    invoiceDate || null,
    invoiceValue ?? null,
    distanceKm ?? null,
    partyId || null,
    transportVendorId || null,
    partyMaterialRateId || null,
    transportRateId || null,
    ...(dispatchHasPartyOrder ? [partyOrderId || null] : []),
    materialRatePerTon ?? null,
    ...optionalQuantityValues,
    ...optionalBillingSnapshotValues,
    ...optionalRateUnitValues,
    ...optionalRoyaltyValues,
    ...optionalLoadingValues,
    materialAmount ?? null,
    transportRateType || null,
    transportRateValue ?? null,
    transportCost ?? null,
    royaltyMode || null,
    royaltyValue ?? null,
    royaltyAmount ?? null,
    loadingCharge ?? null,
    otherCharge ?? 0,
    totalInvoiceValue ?? null,
    billingNotes || null,
    gstRate ?? null,
    cgst ?? null,
    sgst ?? null,
    igst ?? null,
    totalWithGst ?? null,
    ...(dispatchHasCompany ? [companyId || null] : []),
  ];

  const result = await db.query(query, values);
  return await findDispatchById(result.rows[0].id, db, companyId || null);
};

const updateDispatchReportById = async ({
  reportId,
  dispatchDate,
  sourceType,
  sourceName,
  materialType,
  vehicleNumber,
  destinationName,
  quantityTons,
  enteredQuantity,
  enteredUnitId,
  quantitySource,
  conversionFactorToTon,
  conversionId,
  conversionMethodSnapshot,
  sourceVehicleCapacityTons,
  sourceVehicleCapacityUnitId,
  billingBasisSnapshot,
  billingUnitIdSnapshot,
  billedQuantitySnapshot,
  billedRateSnapshot,
  transportBasisSnapshot,
  transportUnitIdSnapshot,
  transportQuantitySnapshot,
  conversionNotesSnapshot,
  remarks,
  plantId,
  materialId,
  vehicleId,
  ewbNumber,
  ewbDate,
  ewbValidUpto,
  invoiceNumber,
  invoiceDate,
  invoiceValue,
  distanceKm,
  partyId,
  transportVendorId,
  partyMaterialRateId,
  transportRateId,
  partyOrderId,
  materialRatePerTon,
  materialRateUnit,
  materialRateUnitLabel,
  materialRateUnitsPerTon,
  materialAmount,
  transportRateType,
  transportRateValue,
  transportCost,
  royaltyMode,
  royaltyValue,
  royaltyTonsPerBrass,
  royaltyAmount,
  loadingCharge,
  loadingChargeBasis,
  loadingChargeRate,
  loadingChargeIsManual,
  otherCharge,
  totalInvoiceValue,
  billingNotes,
  gstRate,
  cgst,
  sgst,
  igst,
  totalWithGst,
  companyId,
}, db = pool) => {
  const dispatchHasCompany = await hasColumn("dispatch_reports", "company_id", db);
  const dispatchHasPartyOrder = await hasColumn("dispatch_reports", "party_order_id", db);
  const hasMaterialRateUnit = await hasColumn("dispatch_reports", "material_rate_unit", db);
  const hasMaterialRateUnitLabel = await hasColumn("dispatch_reports", "material_rate_unit_label", db);
  const hasMaterialRateUnitsPerTon = await hasColumn("dispatch_reports", "material_rate_units_per_ton", db);
  const hasRoyaltyTonsPerBrass = await hasColumn("dispatch_reports", "royalty_tons_per_brass", db);
  const hasLoadingChargeBasis = await hasColumn("dispatch_reports", "loading_charge_basis", db);
  const hasLoadingChargeRate = await hasColumn("dispatch_reports", "loading_charge_rate", db);
  const hasLoadingChargeIsManual = await hasColumn("dispatch_reports", "loading_charge_is_manual", db);
  const hasEnteredQuantity = await hasColumn("dispatch_reports", "entered_quantity", db);
  const hasEnteredUnitId = await hasColumn("dispatch_reports", "entered_unit_id", db);
  const hasQuantitySource = await hasColumn("dispatch_reports", "quantity_source", db);
  const hasConversionFactorToTon = await hasColumn("dispatch_reports", "conversion_factor_to_ton", db);
  const hasConversionId = await hasColumn("dispatch_reports", "conversion_id", db);
  const hasConversionMethodSnapshot = await hasColumn("dispatch_reports", "conversion_method_snapshot", db);
  const hasSourceVehicleCapacityTons = await hasColumn("dispatch_reports", "source_vehicle_capacity_tons", db);
  const hasSourceVehicleCapacityUnitId = await hasColumn("dispatch_reports", "source_vehicle_capacity_unit_id", db);
  const hasBillingBasisSnapshot = await hasColumn("dispatch_reports", "billing_basis_snapshot", db);
  const hasBillingUnitIdSnapshot = await hasColumn("dispatch_reports", "billing_unit_id_snapshot", db);
  const hasBilledQuantitySnapshot = await hasColumn("dispatch_reports", "billed_quantity_snapshot", db);
  const hasBilledRateSnapshot = await hasColumn("dispatch_reports", "billed_rate_snapshot", db);
  const hasTransportBasisSnapshot = await hasColumn("dispatch_reports", "transport_basis_snapshot", db);
  const hasTransportUnitIdSnapshot = await hasColumn("dispatch_reports", "transport_unit_id_snapshot", db);
  const hasTransportQuantitySnapshot = await hasColumn("dispatch_reports", "transport_quantity_snapshot", db);
  const hasConversionNotesSnapshot = await hasColumn("dispatch_reports", "conversion_notes_snapshot", db);
  const optionalQuantityValues = [
    ...(hasEnteredQuantity ? [enteredQuantity ?? null] : []),
    ...(hasEnteredUnitId ? [enteredUnitId ?? null] : []),
    ...(hasQuantitySource ? [quantitySource || null] : []),
    ...(hasConversionFactorToTon ? [conversionFactorToTon ?? null] : []),
    ...(hasConversionId ? [conversionId ?? null] : []),
    ...(hasConversionMethodSnapshot ? [conversionMethodSnapshot || null] : []),
    ...(hasSourceVehicleCapacityTons ? [sourceVehicleCapacityTons ?? null] : []),
    ...(hasSourceVehicleCapacityUnitId ? [sourceVehicleCapacityUnitId ?? null] : []),
  ];
  const quantityStartIndex = dispatchHasPartyOrder ? 25 : 24;
  const optionalQuantityAssignments = [
    hasEnteredQuantity ? `entered_quantity = $${quantityStartIndex}` : null,
    hasEnteredUnitId
      ? `entered_unit_id = $${quantityStartIndex + (hasEnteredQuantity ? 1 : 0)}`
      : null,
    hasQuantitySource
      ? `quantity_source = $${quantityStartIndex + (hasEnteredQuantity ? 1 : 0) + (hasEnteredUnitId ? 1 : 0)}`
      : null,
    hasConversionFactorToTon
      ? `conversion_factor_to_ton = $${quantityStartIndex + (hasEnteredQuantity ? 1 : 0) + (hasEnteredUnitId ? 1 : 0) + (hasQuantitySource ? 1 : 0)}`
      : null,
    hasConversionId
      ? `conversion_id = $${quantityStartIndex + (hasEnteredQuantity ? 1 : 0) + (hasEnteredUnitId ? 1 : 0) + (hasQuantitySource ? 1 : 0) + (hasConversionFactorToTon ? 1 : 0)}`
      : null,
    hasConversionMethodSnapshot
      ? `conversion_method_snapshot = $${quantityStartIndex + (hasEnteredQuantity ? 1 : 0) + (hasEnteredUnitId ? 1 : 0) + (hasQuantitySource ? 1 : 0) + (hasConversionFactorToTon ? 1 : 0) + (hasConversionId ? 1 : 0)}`
      : null,
    hasSourceVehicleCapacityTons
      ? `source_vehicle_capacity_tons = $${quantityStartIndex + (hasEnteredQuantity ? 1 : 0) + (hasEnteredUnitId ? 1 : 0) + (hasQuantitySource ? 1 : 0) + (hasConversionFactorToTon ? 1 : 0) + (hasConversionId ? 1 : 0) + (hasConversionMethodSnapshot ? 1 : 0)}`
      : null,
    hasSourceVehicleCapacityUnitId
      ? `source_vehicle_capacity_unit_id = $${quantityStartIndex + (hasEnteredQuantity ? 1 : 0) + (hasEnteredUnitId ? 1 : 0) + (hasQuantitySource ? 1 : 0) + (hasConversionFactorToTon ? 1 : 0) + (hasConversionId ? 1 : 0) + (hasConversionMethodSnapshot ? 1 : 0) + (hasSourceVehicleCapacityTons ? 1 : 0)}`
      : null,
  ].filter(Boolean);
  const optionalBillingSnapshotValues = [
    ...(hasBillingBasisSnapshot ? [billingBasisSnapshot || null] : []),
    ...(hasBillingUnitIdSnapshot ? [billingUnitIdSnapshot ?? null] : []),
    ...(hasBilledQuantitySnapshot ? [billedQuantitySnapshot ?? null] : []),
    ...(hasBilledRateSnapshot ? [billedRateSnapshot ?? null] : []),
    ...(hasTransportBasisSnapshot ? [transportBasisSnapshot || null] : []),
    ...(hasTransportUnitIdSnapshot ? [transportUnitIdSnapshot ?? null] : []),
    ...(hasTransportQuantitySnapshot ? [transportQuantitySnapshot ?? null] : []),
    ...(hasConversionNotesSnapshot ? [conversionNotesSnapshot || null] : []),
  ];
  const billingSnapshotStartIndex = quantityStartIndex + optionalQuantityValues.length;
  const optionalBillingSnapshotAssignments = [
    hasBillingBasisSnapshot ? `billing_basis_snapshot = $${billingSnapshotStartIndex}` : null,
    hasBillingUnitIdSnapshot
      ? `billing_unit_id_snapshot = $${billingSnapshotStartIndex + (hasBillingBasisSnapshot ? 1 : 0)}`
      : null,
    hasBilledQuantitySnapshot
      ? `billed_quantity_snapshot = $${billingSnapshotStartIndex + (hasBillingBasisSnapshot ? 1 : 0) + (hasBillingUnitIdSnapshot ? 1 : 0)}`
      : null,
    hasBilledRateSnapshot
      ? `billed_rate_snapshot = $${billingSnapshotStartIndex + (hasBillingBasisSnapshot ? 1 : 0) + (hasBillingUnitIdSnapshot ? 1 : 0) + (hasBilledQuantitySnapshot ? 1 : 0)}`
      : null,
    hasTransportBasisSnapshot
      ? `transport_basis_snapshot = $${billingSnapshotStartIndex + (hasBillingBasisSnapshot ? 1 : 0) + (hasBillingUnitIdSnapshot ? 1 : 0) + (hasBilledQuantitySnapshot ? 1 : 0) + (hasBilledRateSnapshot ? 1 : 0)}`
      : null,
    hasTransportUnitIdSnapshot
      ? `transport_unit_id_snapshot = $${billingSnapshotStartIndex + (hasBillingBasisSnapshot ? 1 : 0) + (hasBillingUnitIdSnapshot ? 1 : 0) + (hasBilledQuantitySnapshot ? 1 : 0) + (hasBilledRateSnapshot ? 1 : 0) + (hasTransportBasisSnapshot ? 1 : 0)}`
      : null,
    hasTransportQuantitySnapshot
      ? `transport_quantity_snapshot = $${billingSnapshotStartIndex + (hasBillingBasisSnapshot ? 1 : 0) + (hasBillingUnitIdSnapshot ? 1 : 0) + (hasBilledQuantitySnapshot ? 1 : 0) + (hasBilledRateSnapshot ? 1 : 0) + (hasTransportBasisSnapshot ? 1 : 0) + (hasTransportUnitIdSnapshot ? 1 : 0)}`
      : null,
    hasConversionNotesSnapshot
      ? `conversion_notes_snapshot = $${billingSnapshotStartIndex + (hasBillingBasisSnapshot ? 1 : 0) + (hasBillingUnitIdSnapshot ? 1 : 0) + (hasBilledQuantitySnapshot ? 1 : 0) + (hasBilledRateSnapshot ? 1 : 0) + (hasTransportBasisSnapshot ? 1 : 0) + (hasTransportUnitIdSnapshot ? 1 : 0) + (hasTransportQuantitySnapshot ? 1 : 0)}`
      : null,
  ].filter(Boolean);
  const optionalRateUnitValues = [
    ...(hasMaterialRateUnit ? [materialRateUnit || "per_ton"] : []),
    ...(hasMaterialRateUnitLabel ? [materialRateUnitLabel || "ton"] : []),
    ...(hasMaterialRateUnitsPerTon ? [materialRateUnitsPerTon ?? 1] : []),
  ];
  const optionalRoyaltyValues = [
    ...(hasRoyaltyTonsPerBrass ? [royaltyTonsPerBrass ?? null] : []),
  ];
  const optionalLoadingValues = [
    ...(hasLoadingChargeBasis ? [loadingChargeBasis || "fixed"] : []),
    ...(hasLoadingChargeRate ? [loadingChargeRate ?? loadingCharge ?? null] : []),
    ...(hasLoadingChargeIsManual ? [Boolean(loadingChargeIsManual)] : []),
  ];
  const rateUnitStartIndex = billingSnapshotStartIndex + optionalBillingSnapshotValues.length;
  const optionalRateUnitAssignments = [
    hasMaterialRateUnit ? `material_rate_unit = $${rateUnitStartIndex}` : null,
    hasMaterialRateUnitLabel ? `material_rate_unit_label = $${rateUnitStartIndex + (hasMaterialRateUnit ? 1 : 0)}` : null,
    hasMaterialRateUnitsPerTon ? `material_rate_units_per_ton = $${rateUnitStartIndex + (hasMaterialRateUnit ? 1 : 0) + (hasMaterialRateUnitLabel ? 1 : 0)}` : null,
  ].filter(Boolean);
  const royaltyStartIndex = rateUnitStartIndex + optionalRateUnitValues.length;
  const optionalRoyaltyAssignments = [
    hasRoyaltyTonsPerBrass ? `royalty_tons_per_brass = $${royaltyStartIndex}` : null,
  ].filter(Boolean);
  const loadingStartIndex = royaltyStartIndex + optionalRoyaltyValues.length;
  const optionalLoadingAssignments = [
    hasLoadingChargeBasis ? `loading_charge_basis = $${loadingStartIndex}` : null,
    hasLoadingChargeRate
      ? `loading_charge_rate = $${loadingStartIndex + (hasLoadingChargeBasis ? 1 : 0)}`
      : null,
    hasLoadingChargeIsManual
      ? `loading_charge_is_manual = $${loadingStartIndex + (hasLoadingChargeBasis ? 1 : 0) + (hasLoadingChargeRate ? 1 : 0)}`
      : null,
  ].filter(Boolean);
  const offset =
    optionalQuantityValues.length +
    optionalBillingSnapshotValues.length +
    optionalRateUnitValues.length +
    optionalRoyaltyValues.length +
    optionalLoadingValues.length;
  const query = `
    UPDATE dispatch_reports
    SET
      dispatch_date = $1,
      source_type = $2,
      source_name = $3,
      material_type = $4,
      vehicle_number = $5,
      destination_name = $6,
      quantity_tons = $7,
      remarks = $8,
      plant_id = $9,
      material_id = $10,
      vehicle_id = $11,
      ewb_number = $12,
      ewb_date = $13,
      ewb_valid_upto = $14,
      invoice_number = $15,
      invoice_date = $16,
      invoice_value = $17,
      distance_km = $18,
      party_id = $19,
      transport_vendor_id = $20,
      party_material_rate_id = $21,
      transport_rate_id = $22,
      ${dispatchHasPartyOrder ? `party_order_id = $23,` : ""}
      material_rate_per_ton = $${dispatchHasPartyOrder ? 24 : 23},
      ${optionalQuantityAssignments.length ? `${optionalQuantityAssignments.join(",\n      ")},` : ""}
      ${optionalBillingSnapshotAssignments.length ? `${optionalBillingSnapshotAssignments.join(",\n      ")},` : ""}
      ${optionalRateUnitAssignments.length ? `${optionalRateUnitAssignments.join(",\n      ")},` : ""}
      ${optionalRoyaltyAssignments.length ? `${optionalRoyaltyAssignments.join(",\n      ")},` : ""}
      ${optionalLoadingAssignments.length ? `${optionalLoadingAssignments.join(",\n      ")},` : ""}
      material_amount = $${(dispatchHasPartyOrder ? 25 : 24) + offset},
      transport_rate_type = $${(dispatchHasPartyOrder ? 26 : 25) + offset},
      transport_rate_value = $${(dispatchHasPartyOrder ? 27 : 26) + offset},
      transport_cost = $${(dispatchHasPartyOrder ? 28 : 27) + offset},
      royalty_mode = $${(dispatchHasPartyOrder ? 29 : 28) + offset},
      royalty_value = $${(dispatchHasPartyOrder ? 30 : 29) + offset},
      royalty_amount = $${(dispatchHasPartyOrder ? 31 : 30) + offset},
      loading_charge = $${(dispatchHasPartyOrder ? 32 : 31) + offset},
      other_charge = $${(dispatchHasPartyOrder ? 33 : 32) + offset},
      total_invoice_value = $${(dispatchHasPartyOrder ? 34 : 33) + offset},
      billing_notes = $${(dispatchHasPartyOrder ? 35 : 34) + offset},
      gst_rate = $${(dispatchHasPartyOrder ? 36 : 35) + offset},
      cgst = $${(dispatchHasPartyOrder ? 37 : 36) + offset},
      sgst = $${(dispatchHasPartyOrder ? 38 : 37) + offset},
      igst = $${(dispatchHasPartyOrder ? 39 : 38) + offset},
      total_with_gst = $${(dispatchHasPartyOrder ? 40 : 39) + offset},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $${(dispatchHasPartyOrder ? 41 : 40) + offset}
    ${dispatchHasCompany && companyId !== null ? `AND company_id = $${(dispatchHasPartyOrder ? 42 : 41) + offset}` : ""}
    RETURNING id
  `;

  const values = [
    dispatchDate,
    sourceType,
    sourceName,
    materialType,
    vehicleNumber,
    destinationName,
    quantityTons,
    remarks || null,
    plantId || null,
    materialId || null,
    vehicleId || null,
    ewbNumber || null,
    ewbDate || null,
    ewbValidUpto || null,
    invoiceNumber || null,
    invoiceDate || null,
    invoiceValue ?? null,
    distanceKm ?? null,
    partyId || null,
    transportVendorId || null,
    partyMaterialRateId || null,
    transportRateId || null,
    ...(dispatchHasPartyOrder ? [partyOrderId || null] : []),
    materialRatePerTon ?? null,
    ...optionalQuantityValues,
    ...optionalBillingSnapshotValues,
    ...optionalRateUnitValues,
    ...optionalRoyaltyValues,
    ...optionalLoadingValues,
    materialAmount ?? null,
    transportRateType || null,
    transportRateValue ?? null,
    transportCost ?? null,
    royaltyMode || null,
    royaltyValue ?? null,
    royaltyAmount ?? null,
    loadingCharge ?? null,
    otherCharge ?? 0,
    totalInvoiceValue ?? null,
    billingNotes || null,
    gstRate ?? null,
    cgst ?? null,
    sgst ?? null,
    igst ?? null,
    totalWithGst ?? null,
    reportId,
    ...(dispatchHasCompany && companyId !== null ? [companyId] : []),
  ];

  const result = await db.query(query, values);

  if (result.rows.length === 0) {
    const error = new Error("Dispatch report not found");
    error.statusCode = 404;
    throw error;
  }

  return await findDispatchById(reportId, db, companyId || null);
};

const updateDispatchStatusById = async (
  { reportId, status, invoiceNumber = null, invoiceDate = null, companyId },
  db = pool
) => {
  const dispatchHasCompany = await hasColumn("dispatch_reports", "company_id", db);
  const query = `
    UPDATE dispatch_reports
    SET
      status = $1,
      invoice_number = COALESCE($2, invoice_number),
      invoice_date = COALESCE($3, invoice_date),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    ${dispatchHasCompany && companyId !== null ? "AND company_id = $5" : ""}
    RETURNING id
  `;

  const values = [
    status,
    invoiceNumber,
    invoiceDate,
    reportId,
    ...(dispatchHasCompany && companyId !== null ? [companyId] : []),
  ];

  const result = await db.query(query, values);

  if (result.rows.length === 0) {
    const error = new Error("Dispatch report not found");
    error.statusCode = 404;
    throw error;
  }

  return await findDispatchById(reportId, db, companyId || null);
};

const generateDispatchInvoiceNumber = async (
  { dispatchDate, companyId = null },
  db = pool
) => {
  const dispatchHasCompany = await hasColumn("dispatch_reports", "company_id", db);
  const dateToken = String(dispatchDate || "").replace(/-/g, "");
  const prefix = `INV-${dateToken}-`;
  const query = `
    SELECT invoice_number AS "invoiceNumber"
    FROM dispatch_reports
    WHERE invoice_number LIKE $1
    ${dispatchHasCompany && companyId !== null ? `AND company_id = $2` : ""}
  `;

  const result = await db.query(
    query,
    dispatchHasCompany && companyId !== null ? [`${prefix}%`, companyId] : [`${prefix}%`]
  );

  const maxSequence = result.rows.reduce((max, row) => {
    const match = String(row.invoiceNumber || "").match(/^INV-\d{8}-(\d+)$/);
    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(4, "0")}`;
};

const setVehicleOperationalStatus = async ({ vehicleId, status, companyId }, db = pool) => {
  const vehiclesHasCompany = await hasColumn("vehicles", "company_id", db);
  const query = `
    UPDATE vehicles
    SET
      status = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    ${vehiclesHasCompany && companyId !== null ? `AND company_id = $3` : ""}
    RETURNING id
  `;

  const result = await db.query(
    query,
    vehiclesHasCompany && companyId !== null ? [status, vehicleId, companyId] : [status, vehicleId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Vehicle not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

const plantExists = async (plantId, companyId = null) => {
  const plantsHasCompany = await hasColumn("plant_master", "company_id");
  const query = `
    SELECT
      id,
      plant_name AS "plantName",
      plant_type AS "plantType"
    FROM plant_master
    WHERE id = $1
    ${plantsHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    plantsHasCompany && companyId !== null ? [plantId, companyId] : [plantId]
  );
  return result.rows[0] || null;
};

const materialExists = async (materialId, companyId = null) => {
  const materialsHasCompany = await hasColumn("material_master", "company_id");
  const query = `
    SELECT
      id,
      material_name AS "materialName",
      material_code AS "materialCode",
      gst_rate AS "gstRate"
    FROM material_master
    WHERE id = $1
    ${materialsHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    materialsHasCompany && companyId !== null ? [materialId, companyId] : [materialId]
  );

  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    gstRate: toNumberOrNull(result.rows[0].gstRate),
  };
};

const vehicleExists = async (vehicleId, companyId = null) => {
  const vehiclesHasCompany = await hasColumn("vehicles", "company_id");
  const query = `
    SELECT
      id,
      vehicle_number AS "vehicleNumber",
      vehicle_type AS "vehicleType",
      assigned_driver AS "assignedDriver",
      status,
      plant_id AS "plantId",
      vendor_id AS "vendorId",
      ownership_type AS "ownershipType",
      vehicle_capacity_tons AS "vehicleCapacityTons"
    FROM vehicles
    WHERE id = $1
    ${vehiclesHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    vehiclesHasCompany && companyId !== null ? [vehicleId, companyId] : [vehicleId]
  );

  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    vehicleCapacityTons:
      result.rows[0].vehicleCapacityTons !== null
        ? Number(result.rows[0].vehicleCapacityTons)
        : null,
  };
};

const partyExists = async (partyId, companyId = null) => {
  const partiesHasCompany = await hasColumn("party_master", "company_id");
  const query = `
    SELECT
      id,
      party_name AS "partyName",
      party_type AS "partyType"
    FROM party_master
    WHERE id = $1
    ${partiesHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    partiesHasCompany && companyId !== null ? [partyId, companyId] : [partyId]
  );
  return result.rows[0] || null;
};

const vendorExists = async (vendorId, companyId = null) => {
  const vendorsHasCompany = await hasColumn("vendor_master", "company_id");
  const query = `
    SELECT
      id,
      vendor_name AS "vendorName",
      vendor_type AS "vendorType"
    FROM vendor_master
    WHERE id = $1
    ${vendorsHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    vendorsHasCompany && companyId !== null ? [vendorId, companyId] : [vendorId]
  );
  return result.rows[0] || null;
};

const findActivePartyMaterialRate = async ({
  plantId,
  partyId,
  materialId,
  companyId,
  effectiveDate,
}) => {
  const ratesHasCompany = await hasColumn("party_material_rates", "company_id");
  const ratesHasEffectiveFrom = await hasColumn("party_material_rates", "effective_from");
  const ratesHasLoadingChargeBasis = await hasColumn(
    "party_material_rates",
    "loading_charge_basis"
  );
  const effectiveRateDate = String(effectiveDate || "").trim() || null;
  const params = [plantId, partyId, materialId];
  let nextParamIndex = params.length + 1;
  const effectiveDateFilter =
    ratesHasEffectiveFrom && effectiveRateDate
      ? `AND COALESCE(effective_from, CURRENT_DATE) <= $${nextParamIndex++}`
      : "";
  if (ratesHasEffectiveFrom && effectiveRateDate) {
    params.push(effectiveRateDate);
  }
  const companyFilter =
    ratesHasCompany && companyId !== null ? `AND company_id = $${nextParamIndex}` : "";
  if (ratesHasCompany && companyId !== null) {
    params.push(companyId);
  }
  const query = `
    SELECT
      id,
      plant_id AS "plantId",
      party_id AS "partyId",
      material_id AS "materialId",
      rate_per_ton AS "ratePerTon",
      COALESCE(rate_unit, 'per_ton') AS "rateUnit",
      rate_unit_label AS "rateUnitLabel",
      COALESCE(rate_units_per_ton, 1) AS "rateUnitsPerTon",
      royalty_mode AS "royaltyMode",
      royalty_value AS "royaltyValue",
      tons_per_brass AS "tonsPerBrass",
      loading_charge AS "loadingCharge",
      ${
        ratesHasLoadingChargeBasis
          ? `COALESCE(loading_charge_basis, 'fixed') AS "loadingChargeBasis",`
          : `'fixed' AS "loadingChargeBasis",`
      }
      notes,
      ${
        ratesHasEffectiveFrom
          ? `effective_from::text AS "effectiveFrom"`
          : `NULL AS "effectiveFrom"`
      }
    FROM party_material_rates
    WHERE plant_id = $1
      AND party_id = $2
      AND material_id = $3
      AND is_active = TRUE
      ${effectiveDateFilter}
      ${companyFilter}
    ORDER BY ${
      ratesHasEffectiveFrom
        ? `COALESCE(effective_from, CURRENT_DATE) DESC, id DESC`
        : `id DESC`
    }
    LIMIT 1
  `;

  const result = await pool.query(query, params);

  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    ratePerTon: Number(result.rows[0].ratePerTon),
    rateUnitsPerTon: Number(result.rows[0].rateUnitsPerTon || 1),
    royaltyValue: Number(result.rows[0].royaltyValue || 0),
    tonsPerBrass:
      result.rows[0].tonsPerBrass === null || result.rows[0].tonsPerBrass === undefined
        ? null
        : Number(result.rows[0].tonsPerBrass),
    loadingCharge: Number(result.rows[0].loadingCharge || 0),
    loadingChargeBasis: String(result.rows[0].loadingChargeBasis || "fixed"),
  };
};

const findActiveTransportRate = async ({ plantId, vendorId, materialId, companyId }) => {
  const ratesHasCompany = await hasColumn("transport_rates", "company_id");
  const query = `
    SELECT
      id,
      plant_id AS "plantId",
      vendor_id AS "vendorId",
      material_id AS "materialId",
      rate_type AS "rateType",
      rate_value AS "rateValue",
      distance_km AS "distanceKm"
    FROM transport_rates
    WHERE plant_id = $1
      AND vendor_id = $2
      AND material_id = $3
      AND is_active = TRUE
      ${ratesHasCompany && companyId !== null ? `AND company_id = $4` : ""}
    ORDER BY id DESC
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    ratesHasCompany && companyId !== null
      ? [plantId, vendorId, materialId, companyId]
      : [plantId, vendorId, materialId]
  );

  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    rateValue: Number(result.rows[0].rateValue),
    distanceKm:
      result.rows[0].distanceKm !== null
        ? Number(result.rows[0].distanceKm)
        : null,
  };
};

module.exports = {
  findAllDispatchReports,
  findDispatchReportSummary,
  findDispatchById,
  insertDispatchReport,
  updateDispatchReportById,
  updateDispatchStatusById,
  generateDispatchInvoiceNumber,
  setVehicleOperationalStatus,
  plantExists,
  materialExists,
  vehicleExists,
  partyExists,
  vendorExists,
  findActivePartyMaterialRate,
  findActiveTransportRate,
};
