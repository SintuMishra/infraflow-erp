const { pool } = require("../config/db");

const buildCsv = (rows) => {
  const headers = [
    "id",
    "materialName",
    "materialCode",
    "category",
    "unit",
    "gstRate",
    "isActive",
  ];

  const escapeCell = (value) => {
    const text = String(value ?? "");

    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n");
};

const formatBoolean = (value) => (value ? "Yes" : "No");

const main = async () => {
  const result = await pool.query(`
    SELECT
      id,
      material_name AS "materialName",
      material_code AS "materialCode",
      category,
      unit,
      gst_rate AS "gstRate",
      is_active AS "isActive"
    FROM material_master
    WHERE COALESCE(BTRIM(hsn_sac_code), '') = ''
    ORDER BY is_active DESC, material_name ASC
  `);

  const rows = result.rows;

  if (rows.length === 0) {
    console.log("All materials already have HSN/SAC configured.");
    return;
  }

  console.log("Materials Missing HSN/SAC");
  console.table(
    rows.map((row) => ({
      id: row.id,
      materialName: row.materialName,
      materialCode: row.materialCode || "-",
      category: row.category || "-",
      unit: row.unit || "-",
      gstRate: row.gstRate,
      isActive: formatBoolean(row.isActive),
    }))
  );

  console.log("\nCSV");
  console.log(buildCsv(rows));
};

main()
  .catch((error) => {
    const details =
      error?.stack ||
      error?.message ||
      (typeof error === "string" ? error : JSON.stringify(error, null, 2));
    console.error("Failed to generate missing HSN/SAC report:");
    console.error(details);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
