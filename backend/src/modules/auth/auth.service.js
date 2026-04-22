const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

const {
  createAuthRefreshToken,
  createPasswordResetToken,
  findCompanyAccessById,
  findActiveCompanyLoginContextByCode,
  findUsersByLoginIdentifier,
  findUserForPasswordRecovery,
  findValidAuthRefreshToken,
  findValidPasswordResetToken,
  findUserByEmployeeId,
  findEmployeeById,
  createUser,
  getUserSelfProfileById,
  markPasswordResetTokenUsed,
  revokeActivePasswordResetTokensForUser,
  revokeAllAuthRefreshTokensForUser,
  revokeAuthRefreshTokenById,
  setTemporaryPasswordByUserId,
  updateUserSelfProfileById,
  updateLastLogin,
  updatePasswordByUserId,
  findUserById,
} = require("./auth.model");
const {
  buildUsernameFromEmployeeCode,
  generatePasswordResetOtp,
  generateSessionToken,
  generateTemporaryPassword,
  hashSensitiveToken,
} = require("../../utils/loginCredentials.util");
const { getCompanyProfile } = require("../company_profile/company_profile.service");
const { recordAuditEvent } = require("../../utils/audit.util");
const { normalizeCompanyId } = require("../../utils/companyScope.util");
const { normalizeRole } = require("../../utils/role.util");
const {
  dispatchPasswordResetInstruction,
} = require("../../utils/passwordResetDelivery.util");

const ROLE_ASSIGNMENT_RULES = {
  super_admin: ["hr", "manager", "crusher_supervisor", "site_engineer", "operator"],
  hr: ["crusher_supervisor", "site_engineer", "operator"],
  manager: ["hr", "manager", "crusher_supervisor", "site_engineer", "operator"],
};

const PLATFORM_OWNER_COMPANY_ID =
  Number.isInteger(env.platformOwnerCompanyId) && env.platformOwnerCompanyId > 0
    ? env.platformOwnerCompanyId
    : null;

const buildAccessTokenPayload = ({
  user,
  companyId,
  mustChangePassword,
}) => ({
  userId: user.id,
  employeeId: user.employeeId,
  username: user.username,
  role: normalizeRole(user.role),
  companyId,
  mustChangePassword: Boolean(mustChangePassword),
  tokenType: "access",
});

const resolveCompanyContext = async (companyId) => {
  const normalizedCompanyId = normalizeCompanyId(companyId);

  if (normalizedCompanyId === null) {
    return null;
  }

  const [companyProfile, companyAccess] = await Promise.all([
    getCompanyProfile(normalizedCompanyId),
    findCompanyAccessById(normalizedCompanyId),
  ]);

  const companyName =
    companyProfile?.companyName || companyAccess?.companyName || null;
  const branchName = companyProfile?.branchName || "";

  if (!companyName) {
    return null;
  }

  return {
    id: normalizedCompanyId,
    companyName,
    branchName,
  };
};

const issueAuthSession = async ({
  user,
  companyId,
  mustChangePassword = false,
  requestedByIp = null,
  requestedByUserAgent = null,
}) => {
  const accessToken = jwt.sign(
    buildAccessTokenPayload({
      user,
      companyId,
      mustChangePassword,
    }),
    env.jwtSecret,
    { expiresIn: `${env.accessTokenTtlMinutes}m` }
  );

  const refreshToken = generateSessionToken();
  const refreshTokenHash = hashSensitiveToken(refreshToken);
  const refreshTokenExpiresAt = new Date(
    Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  );

  try {
    await createAuthRefreshToken({
      userId: user.id,
      companyId: companyId || null,
      tokenHash: refreshTokenHash,
      expiresAt: refreshTokenExpiresAt,
      issuedByIp: requestedByIp,
      issuedByUserAgent: requestedByUserAgent,
    });
  } catch (error) {
    if (error?.code === "42P01") {
      const migrationError = new Error(
        "Auth session storage is not initialized. Run latest migrations."
      );
      migrationError.statusCode = 503;
      throw migrationError;
    }
    throw error;
  }

  return {
    token: accessToken,
    refreshToken,
    refreshTokenExpiresAt,
  };
};

const getAuthModuleInfo = async () => {
  return {
    module: "auth",
    status: "ready",
    message: "Auth service is working",
  };
};

const createUserAccount = async ({
  employeeId,
  role,
  companyId,
  actorUserId = null,
  actorRole = "",
}) => {
  const normalizedRole = normalizeRole(role);
  const normalizedActorRole = normalizeRole(actorRole);
  const allowedRoles = ROLE_ASSIGNMENT_RULES[normalizedActorRole] || [];

  if (!allowedRoles.includes(normalizedRole)) {
    throw new Error("ROLE_ASSIGNMENT_NOT_ALLOWED");
  }

  const employee = await findEmployeeById(employeeId, companyId);

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  if (employee.status !== "active") {
    throw new Error("EMPLOYEE_NOT_ACTIVE");
  }

  const existingUser = await findUserByEmployeeId(employeeId, companyId);

  if (existingUser) {
    throw new Error("USER_ALREADY_EXISTS");
  }

  const username = buildUsernameFromEmployeeCode(employee.employeeCode);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const user = await createUser({
    employeeId,
    username,
    passwordHash,
    role: normalizedRole,
    companyId: employee.companyId || companyId || null,
  });

  await recordAuditEvent({
    action: "auth.login_account_created",
    actorUserId,
    targetType: "user",
    targetId: user.id,
    companyId: user.companyId || employee.companyId || companyId || null,
    details: {
      employeeId,
      username,
      role: normalizedRole,
    },
  });

  return {
    ...user,
    temporaryPassword,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
  };
};

const resolveMatchingUser = async ({ identifier, password, companyId }) => {
  const candidates = await findUsersByLoginIdentifier(identifier, companyId);

  for (const candidate of candidates) {
    const isPasswordValid = await bcrypt.compare(password, candidate.passwordHash);

    if (isPasswordValid) {
      return candidate;
    }
  }

  return null;
};

const getCompanyLoginContext = async ({ companyCode }) => {
  const company = await findActiveCompanyLoginContextByCode(companyCode);

  if (!company) {
    throw new Error("COMPANY_LOGIN_CONTEXT_NOT_FOUND");
  }

  return {
    id: company.id,
    companyCode: company.companyCode,
    companyName: company.companyName,
    isActive: Boolean(company.isActive),
  };
};

const enforceLoginIntentRules = ({
  user,
  resolvedCompanyId,
  loginIntent,
  expectedCompanyId = null,
}) => {
  const normalizedResolvedCompanyId = normalizeCompanyId(resolvedCompanyId);
  const normalizedExpectedCompanyId = normalizeCompanyId(expectedCompanyId);
  const normalizedIntent = String(loginIntent || "")
    .trim()
    .toLowerCase();

  if (normalizedIntent === "owner") {
    if (normalizeRole(user.role) !== "super_admin") {
      throw new Error("OWNER_LOGIN_ONLY_SUPER_ADMIN");
    }

    if (
      PLATFORM_OWNER_COMPANY_ID !== null &&
      normalizedResolvedCompanyId !== PLATFORM_OWNER_COMPANY_ID
    ) {
      throw new Error("OWNER_LOGIN_SCOPE_MISMATCH");
    }
  }

  if (normalizedIntent === "client") {
    if (
      normalizedExpectedCompanyId !== null &&
      normalizedResolvedCompanyId !== normalizedExpectedCompanyId
    ) {
      throw new Error("CLIENT_LOGIN_COMPANY_MISMATCH");
    }

    if (
      PLATFORM_OWNER_COMPANY_ID !== null &&
      normalizedResolvedCompanyId === PLATFORM_OWNER_COMPANY_ID
    ) {
      throw new Error("CLIENT_LOGIN_OWNER_SCOPE_BLOCKED");
    }
  }
};

const loginUser = async ({
  identifier,
  password,
  companyId,
  loginIntent = "",
  expectedCompanyId = null,
  requestedByIp = null,
  requestedByUserAgent = null,
}) => {
  const user = await resolveMatchingUser({
    identifier,
    password,
    companyId,
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new Error("USER_INACTIVE");
  }

  const resolvedCompanyId = normalizeCompanyId(user.companyId || companyId);

  if (resolvedCompanyId !== null) {
    const company = await findCompanyAccessById(resolvedCompanyId);

    if (company && !company.isActive) {
      throw new Error("COMPANY_ACCESS_DISABLED");
    }
  }

  enforceLoginIntentRules({
    user,
    resolvedCompanyId,
    loginIntent,
    expectedCompanyId,
  });

  await updateLastLogin(user.id);

  const company = await resolveCompanyContext(resolvedCompanyId);

  const session = await issueAuthSession({
    user,
    companyId: resolvedCompanyId,
    mustChangePassword: Boolean(user.mustChangePassword),
    requestedByIp,
    requestedByUserAgent,
  });

  return {
    token: session.token,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    mustChangePassword: user.mustChangePassword,
    user: {
      id: user.id,
      employeeId: user.employeeId,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      username: user.username,
      role: normalizeRole(user.role),
      department: user.department,
      designation: user.designation,
      companyId: resolvedCompanyId,
      mustChangePassword: Boolean(user.mustChangePassword),
    },
    company,
  };
};

const changePassword = async ({
  userId,
  companyId,
  currentPassword,
  newPassword,
  requestedByIp = null,
  requestedByUserAgent = null,
}) => {
  const user = await findUserById(userId, companyId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const isPasswordValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await updatePasswordByUserId({
    userId: user.id,
    passwordHash: newPasswordHash,
  });
  await revokeAllAuthRefreshTokensForUser({
    userId: user.id,
    companyId: user.companyId || companyId || null,
  });

  const refreshedUser = await findUserById(user.id, companyId);

  if (!refreshedUser) {
    throw new Error("USER_NOT_FOUND");
  }

  await recordAuditEvent({
    action: "auth.password_changed",
    actorUserId: refreshedUser.id,
    targetType: "user",
    targetId: refreshedUser.id,
    companyId: refreshedUser.companyId || companyId || null,
    details: {
      via: "authenticated_user",
    },
  });

  const session = await issueAuthSession({
    user: refreshedUser,
    companyId: refreshedUser.companyId || companyId || null,
    mustChangePassword: false,
    requestedByIp,
    requestedByUserAgent,
  });

  return {
    token: session.token,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    user: {
      id: refreshedUser.id,
      employeeId: refreshedUser.employeeId,
      employeeCode: refreshedUser.employeeCode,
      fullName: refreshedUser.fullName,
      username: refreshedUser.username,
      role: normalizeRole(refreshedUser.role),
      department: refreshedUser.department,
      designation: refreshedUser.designation,
      companyId: refreshedUser.companyId || companyId || null,
      mustChangePassword: false,
    },
  };
};

const initiatePasswordReset = async ({
  identifier,
  mobileNumber,
  companyId,
  requestedByIp,
  requestedByUserAgent,
  exposeToken = false,
}) => {
  const user = await findUserForPasswordRecovery({
    identifier,
    mobileNumber,
    companyId,
  });

  if (!user || !user.isActive) {
    return {
      delivered: false,
      deliveryMode: "unknown",
      deliveryChannels: [],
      deliveryPolicy: env.passwordResetDeliverySuccessPolicy,
      channelStatuses: {},
      deliveryReason: null,
      resetOtp: null,
    };
  }

  await revokeActivePasswordResetTokensForUser(
    user.id,
    user.companyId || companyId || null
  );

  const resetOtp = generatePasswordResetOtp();
  const tokenHash = hashSensitiveToken(resetOtp);
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * env.passwordResetTokenTtlMinutes
  );

  await createPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt,
    companyId: user.companyId || companyId || null,
    requestedByIp,
    requestedByUserAgent,
  });

  const delivery = await dispatchPasswordResetInstruction({
    resetOtp,
    expiresAt,
    user,
    companyId,
    exposeToken,
  });

  await recordAuditEvent({
    action: "auth.password_reset_requested",
    actorUserId: null,
    targetType: "user",
    targetId: user.id,
    companyId: user.companyId || companyId || null,
    details: {
      identifier,
      deliveryMode: delivery.mode,
      deliveryChannels: delivery.deliveryChannels || [],
      deliveryPolicy: delivery.deliveryPolicy || env.passwordResetDeliverySuccessPolicy,
      channelStatuses: delivery.channelStatuses || {},
      deliveryAccepted: Boolean(delivery.accepted),
      deliveryReason: delivery.reason || null,
    },
  });

  return {
    delivered: Boolean(delivery.accepted),
    deliveryMode: delivery.mode,
    deliveryChannels: delivery.deliveryChannels || [],
    deliveryPolicy: delivery.deliveryPolicy || env.passwordResetDeliverySuccessPolicy,
    channelStatuses: delivery.channelStatuses || {},
    deliveryReason: delivery.reason || null,
    resetOtp:
      exposeToken || delivery.mode === "token_response"
        ? resetOtp
        : null,
  };
};

const resetForgottenPassword = async ({
  resetOtp,
  resetToken,
  newPassword,
  companyId,
}) => {
  const normalizedOtp = String(resetOtp || resetToken || "").trim();
  const tokenHash = hashSensitiveToken(normalizedOtp);
  const resetRecord = await findValidPasswordResetToken(tokenHash, companyId);

  if (!resetRecord) {
    throw new Error("INVALID_RESET_TOKEN");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await setTemporaryPasswordByUserId({
    userId: resetRecord.userId,
    passwordHash,
    mustChangePassword: false,
  });

  await markPasswordResetTokenUsed(resetRecord.id);
  await revokeAllAuthRefreshTokensForUser({
    userId: resetRecord.userId,
    companyId: resetRecord.companyId || companyId || null,
  });

  await recordAuditEvent({
    action: "auth.password_reset_completed",
    actorUserId: null,
    targetType: "user",
    targetId: resetRecord.userId,
    companyId: resetRecord.companyId || companyId || null,
    details: {
      via: "forgot_password",
    },
  });

  return {
    success: true,
  };
};

const adminResetPassword = async ({
  employeeId,
  actorUserId,
  companyId,
}) => {
  const user = await findUserByEmployeeId(employeeId, companyId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  await setTemporaryPasswordByUserId({
    userId: user.id,
    passwordHash,
    mustChangePassword: true,
  });

  await revokeActivePasswordResetTokensForUser(
    user.id,
    user.companyId || companyId || null
  );
  await revokeAllAuthRefreshTokensForUser({
    userId: user.id,
    companyId: user.companyId || companyId || null,
  });

  const refreshedUser = await findUserById(user.id, companyId);

  await recordAuditEvent({
    action: "auth.admin_password_reset",
    actorUserId,
    targetType: "user",
    targetId: user.id,
    companyId: refreshedUser?.companyId || companyId || null,
    details: {
      employeeId,
    },
  });

  return {
    id: user.id,
    employeeId: refreshedUser?.employeeId || employeeId,
    employeeCode: refreshedUser?.employeeCode || null,
    username: refreshedUser?.username || null,
    fullName: refreshedUser?.fullName || null,
    temporaryPassword,
    mustChangePassword: true,
  };
};

const refreshAuthSession = async ({
  refreshToken,
  companyId = null,
  requestedByIp = null,
  requestedByUserAgent = null,
}) => {
  const tokenHash = hashSensitiveToken(refreshToken);
  const refreshTokenRecord = await findValidAuthRefreshToken({
    tokenHash,
    companyId,
  });

  if (!refreshTokenRecord || !refreshTokenRecord.userIsActive) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const user = await findUserById(
    refreshTokenRecord.userId,
    refreshTokenRecord.companyId || companyId || null
  );
  if (!user || !user.isActive) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const nextRefreshToken = generateSessionToken();
  const nextRefreshTokenHash = hashSensitiveToken(nextRefreshToken);
  const nextRefreshTokenExpiresAt = new Date(
    Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  );

  const revoked = await revokeAuthRefreshTokenById({
    tokenId: refreshTokenRecord.id,
    replacedByTokenHash: nextRefreshTokenHash,
  });

  if (!revoked) {
    // Concurrent refresh replay: token was already rotated/revoked by another request.
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  await createAuthRefreshToken({
    userId: user.id,
    companyId: refreshTokenRecord.companyId || companyId || null,
    tokenHash: nextRefreshTokenHash,
    expiresAt: nextRefreshTokenExpiresAt,
    issuedByIp: requestedByIp,
    issuedByUserAgent: requestedByUserAgent,
  });

  const accessToken = jwt.sign(
    buildAccessTokenPayload({
      user,
      companyId: refreshTokenRecord.companyId || companyId || null,
      mustChangePassword: Boolean(user.mustChangePassword),
    }),
    env.jwtSecret,
    { expiresIn: `${env.accessTokenTtlMinutes}m` }
  );

  await recordAuditEvent({
    action: "auth.session_refreshed",
    actorUserId: user.id,
    targetType: "user",
    targetId: user.id,
    companyId: refreshTokenRecord.companyId || companyId || null,
    details: {
      via: "refresh_token",
    },
  });

  return {
    token: accessToken,
    refreshToken: nextRefreshToken,
    refreshTokenExpiresAt: nextRefreshTokenExpiresAt,
    user: {
      id: user.id,
      employeeId: user.employeeId,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      username: user.username,
      role: normalizeRole(user.role),
      department: user.department,
      designation: user.designation,
      companyId: user.companyId || companyId || null,
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  };
};

const logoutAuthSession = async ({
  refreshToken,
  companyId = null,
  actorUserId = null,
}) => {
  if (!String(refreshToken || "").trim()) {
    return { success: true };
  }

  const tokenHash = hashSensitiveToken(refreshToken);
  const refreshTokenRecord = await findValidAuthRefreshToken({
    tokenHash,
    companyId,
  });

  if (!refreshTokenRecord) {
    return { success: true };
  }

  await revokeAuthRefreshTokenById({
    tokenId: refreshTokenRecord.id,
  });

  await recordAuditEvent({
    action: "auth.session_logged_out",
    actorUserId: actorUserId || refreshTokenRecord.userId || null,
    targetType: "user",
    targetId: refreshTokenRecord.userId,
    companyId: refreshTokenRecord.companyId || companyId || null,
    details: {
      via: "refresh_token",
    },
  });

  return { success: true };
};

const getAuthenticatedUserProfile = async ({
  userId,
  companyId = null,
}) => {
  const profile = await getUserSelfProfileById(userId, companyId);
  if (!profile) {
    throw new Error("USER_NOT_FOUND");
  }

  const company = await resolveCompanyContext(profile.companyId || companyId);

  return {
    ...profile,
    companyName: company?.companyName || profile.companyName || null,
    branchName: company?.branchName || profile.branchName || "",
    company:
      company ||
      (profile.companyId
        ? {
            id: profile.companyId,
            companyName: null,
            branchName: "",
          }
        : null),
  };
};

const updateAuthenticatedUserProfile = async ({
  userId,
  companyId = null,
  fullName,
  mobileNumber,
  email,
  emergencyContactNumber,
  address,
  department,
  designation,
}) => {
  const profile = await updateUserSelfProfileById({
    userId,
    companyId,
    fullName: String(fullName || "").trim(),
    mobileNumber: String(mobileNumber || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    emergencyContactNumber: String(emergencyContactNumber || "").trim(),
    address: String(address || "").trim(),
    department: String(department || "").trim() || "General",
    designation: String(designation || "").trim() || "Team Member",
  });

  if (!profile) {
    throw new Error("USER_NOT_FOUND");
  }

  await recordAuditEvent({
    action: "auth.self_profile_updated",
    actorUserId: profile.id,
    targetType: "user",
    targetId: profile.id,
    companyId: profile.companyId || companyId || null,
    details: {
      employeeId: profile.employeeId || null,
      fullName: profile.fullName || null,
      department: profile.department || null,
      designation: profile.designation || null,
    },
  });

  return profile;
};

module.exports = {
  adminResetPassword,
  getAuthenticatedUserProfile,
  getCompanyLoginContext,
  ROLE_ASSIGNMENT_RULES,
  getAuthModuleInfo,
  createUserAccount,
  initiatePasswordReset,
  loginUser,
  logoutAuthSession,
  refreshAuthSession,
  updateAuthenticatedUserProfile,
  changePassword,
  resetForgottenPassword,
  resolveMatchingUser,
};
