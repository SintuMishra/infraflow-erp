const validateCreateEmployeeInput = (req, res, next) => {
  const {
    fullName,
    mobileNumber,
    email,
    emergencyContactNumber,
    joiningDate,
    status,
    relievingDate,
    employmentType,
    idProofType,
    idProofNumber,
  } = req.body || {};

  if (!String(fullName || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "fullName is required",
    });
  }

  if (!String(mobileNumber || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "mobileNumber is required",
    });
  }

  if (!/^[0-9]{10,15}$/.test(String(mobileNumber).trim())) {
    return res.status(400).json({
      success: false,
      message: "mobileNumber must be 10 to 15 digits",
    });
  }

  if (
    email !== undefined &&
    email !== null &&
    String(email).trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "email must be a valid email address",
    });
  }

  if (
    emergencyContactNumber !== undefined &&
    emergencyContactNumber !== null &&
    String(emergencyContactNumber).trim() &&
    !/^[0-9]{10,15}$/.test(String(emergencyContactNumber).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "emergencyContactNumber must be 10 to 15 digits",
    });
  }

  const allowedStatuses = ["active", "inactive", "resigned", "terminated"];
  const isOtherCustomValue = (value) =>
    /^other\s*:\s*\S+/i.test(String(value || "").trim());
  const allowedEmploymentTypes = [
    "full_time",
    "contract",
    "intern",
    "temporary",
    "consultant",
    "other",
  ];
  const allowedIdProofTypes = [
    "aadhaar",
    "pan",
    "driving_license",
    "voter_id",
    "passport",
    "other",
  ];
  if (
    status !== undefined &&
    status !== null &&
    String(status).trim() &&
    !allowedStatuses.includes(String(status).trim().toLowerCase())
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid status is required",
    });
  }

  if (
    employmentType !== undefined &&
    employmentType !== null &&
    String(employmentType).trim() &&
    !allowedEmploymentTypes.includes(String(employmentType).trim().toLowerCase()) &&
    !isOtherCustomValue(employmentType)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "employmentType must be one of full_time, contract, intern, temporary, consultant, other",
    });
  }

  if (
    idProofType !== undefined &&
    idProofType !== null &&
    String(idProofType).trim() &&
    !allowedIdProofTypes.includes(String(idProofType).trim().toLowerCase()) &&
    !isOtherCustomValue(idProofType)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "idProofType must be one of aadhaar, pan, driving_license, voter_id, passport, other",
    });
  }

  if (
    idProofNumber !== undefined &&
    idProofNumber !== null &&
    String(idProofNumber).trim() &&
    String(idProofNumber).trim().length > 60
  ) {
    return res.status(400).json({
      success: false,
      message: "idProofNumber must be at most 60 characters",
    });
  }

  if (
    joiningDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(String(joiningDate).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "joiningDate must use YYYY-MM-DD format",
    });
  }

  if (
    relievingDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(String(relievingDate).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "relievingDate must use YYYY-MM-DD format",
    });
  }

  next();
};

const validateEmployeeUpdateInput = (req, res, next) => {
  const {
    fullName,
    mobileNumber,
    email,
    emergencyContactNumber,
    joiningDate,
    status,
    relievingDate,
    employmentType,
    idProofType,
    idProofNumber,
  } = req.body;

  if (!String(fullName || "").trim() || !String(mobileNumber || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "fullName and mobileNumber are required",
    });
  }

  const allowedStatuses = ["active", "inactive", "resigned", "terminated"];
  if (
    status !== undefined &&
    status !== null &&
    String(status).trim() &&
    !allowedStatuses.includes(String(status).trim().toLowerCase())
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid status is required",
    });
  }

  if (
    mobileNumber !== undefined &&
    mobileNumber !== null &&
    String(mobileNumber).trim() &&
    !/^[0-9]{10,15}$/.test(String(mobileNumber).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "mobileNumber must be 10 to 15 digits",
    });
  }

  if (
    email !== undefined &&
    email !== null &&
    String(email).trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "email must be a valid email address",
    });
  }

  if (
    emergencyContactNumber !== undefined &&
    emergencyContactNumber !== null &&
    String(emergencyContactNumber).trim() &&
    !/^[0-9]{10,15}$/.test(String(emergencyContactNumber).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "emergencyContactNumber must be 10 to 15 digits",
    });
  }

  const allowedEmploymentTypes = [
    "full_time",
    "contract",
    "intern",
    "temporary",
    "consultant",
    "other",
  ];
  const isOtherCustomValue = (value) =>
    /^other\s*:\s*\S+/i.test(String(value || "").trim());
  const allowedIdProofTypes = [
    "aadhaar",
    "pan",
    "driving_license",
    "voter_id",
    "passport",
    "other",
  ];

  if (
    employmentType !== undefined &&
    employmentType !== null &&
    String(employmentType).trim() &&
    !allowedEmploymentTypes.includes(String(employmentType).trim().toLowerCase()) &&
    !isOtherCustomValue(employmentType)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "employmentType must be one of full_time, contract, intern, temporary, consultant, other",
    });
  }

  if (
    idProofType !== undefined &&
    idProofType !== null &&
    String(idProofType).trim() &&
    !allowedIdProofTypes.includes(String(idProofType).trim().toLowerCase()) &&
    !isOtherCustomValue(idProofType)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "idProofType must be one of aadhaar, pan, driving_license, voter_id, passport, other",
    });
  }

  if (
    idProofNumber !== undefined &&
    idProofNumber !== null &&
    String(idProofNumber).trim() &&
    String(idProofNumber).trim().length > 60
  ) {
    return res.status(400).json({
      success: false,
      message: "idProofNumber must be at most 60 characters",
    });
  }

  if (
    joiningDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(String(joiningDate).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "joiningDate must use YYYY-MM-DD format",
    });
  }

  if (
    relievingDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(String(relievingDate).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "relievingDate must use YYYY-MM-DD format",
    });
  }

  next();
};

const validateEmployeeStatusInput = (req, res, next) => {
  const { status } = req.body;
  const allowedStatuses = ["active", "inactive", "resigned", "terminated"];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Valid status is required",
    });
  }

  next();
};

module.exports = {
  validateCreateEmployeeInput,
  validateEmployeeUpdateInput,
  validateEmployeeStatusInput,
};
