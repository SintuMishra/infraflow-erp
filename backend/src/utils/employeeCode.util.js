const DEPARTMENT_PREFIX_MAP = {
  Crusher: "CRU",
  HR: "HR",
  Projects: "PRJ",
  Accounts: "ACC",
  "Plant Operations": "PLT",
  Vehicles: "VEH",
  Machinery: "MCH",
  Admin: "EMP",
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