const ROLE_ALIASES = {
  admin: "manager",
  superadmin: "super_admin",
  owner: "super_admin",
  customer_admin: "manager",
  client_admin: "manager",
  administrator: "manager",
};

export const normalizeRole = (role) => {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (!normalized) {
    return "";
  }

  return ROLE_ALIASES[normalized] || normalized;
};
