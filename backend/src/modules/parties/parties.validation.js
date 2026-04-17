const allowedPartyTypes = ["customer", "supplier", "both"];

const isBlank = (value) => String(value || "").trim() === "";

const validatePartyPayload = (req, res, next) => {
  const {
    partyName,
    mobileNumber,
    gstin,
    pan,
    stateCode,
    pincode,
    partyType,
  } = req.body;

  if (isBlank(partyName)) {
    return res.status(400).json({
      success: false,
      message: "partyName is required",
    });
  }

  if (partyType && !allowedPartyTypes.includes(partyType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid party type",
    });
  }

  if (
    mobileNumber &&
    !/^[0-9]{10,15}$/.test(String(mobileNumber).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "mobileNumber must be 10 to 15 digits",
    });
  }

  if (gstin && !/^[0-9A-Z]{15}$/.test(String(gstin).trim().toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: "gstin must be a valid 15 character GSTIN",
    });
  }

  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(pan).trim().toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: "pan must be a valid PAN",
    });
  }

  if (stateCode && !/^[0-9]{1,2}$/.test(String(stateCode).trim())) {
    return res.status(400).json({
      success: false,
      message: "stateCode must be a valid numeric state code",
    });
  }

  if (pincode && !/^[0-9]{6}$/.test(String(pincode).trim())) {
    return res.status(400).json({
      success: false,
      message: "pincode must be a valid 6 digit code",
    });
  }

  next();
};

const validatePartyStatusPayload = (req, res, next) => {
  if (typeof req.body.isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be provided as true or false",
    });
  }

  next();
};

module.exports = {
  validateCreatePartyInput: validatePartyPayload,
  validateUpdatePartyInput: validatePartyPayload,
  validatePartyStatusPayload,
};
