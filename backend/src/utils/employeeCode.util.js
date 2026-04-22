const DEPARTMENT_PREFIX_MAP = {
  Administration: "ADM",
  "Human Resources": "HR",
  "Finance & Accounts": "FIN",
  Finance: "FIN",
  Commercial: "COM",
  Procurement: "PRC",
  Contracts: "CTR",
  Billing: "BIL",
  Audit: "ADT",
  "Project Management": "PRJ",
  Planning: "PLN",
  Execution: "EXE",
  Engineering: "ENG",
  "Quality Assurance": "QAS",
  "Quality Control": "QCT",
  "Safety (EHS)": "EHS",
  "Stores & Inventory": "STR",
  "Logistics & Dispatch": "LOG",
  "Fleet & Transport": "FLT",
  "Crusher Operations": "CRU",
  Crusher: "CRU",
  "Mining": "MIN",
  HR: "HR",
  Projects: "PRJ",
  Accounts: "ACC",
  "Plant Operations": "PLT",
  "Electrical": "ELC",
  "Mechanical": "MEC",
  "Machinery & Maintenance": "MCH",
  Vehicles: "VEH",
  Machinery: "MCH",
  "IT & Systems": "ITS",
  "Legal & Compliance": "LGL",
  Security: "SEC",
  "Business Development": "BDV",
  Sales: "SAL",
  "Customer Support": "CSU",
  Admin: "ADM",
  General: "EMP",
};

const getDepartmentPrefix = (department) => {
  return DEPARTMENT_PREFIX_MAP[department] || "EMP";
};

const buildNextEmployeeCode = (prefix, lastCode) => {
  if (!lastCode) {
    return `${prefix}0001`;
  }

  const numberPart = lastCode.slice(prefix.length);
  const parsedNumber = parseInt(numberPart, 10);

  if (Number.isNaN(parsedNumber)) {
    return `${prefix}0001`;
  }

  const nextNumber = parsedNumber + 1;
  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
};

module.exports = {
  getDepartmentPrefix,
  buildNextEmployeeCode,
};
