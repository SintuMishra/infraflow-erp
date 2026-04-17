const allowedVendorTypes = [
  "Transporter",
  "Equipment Supplier",
  "Manpower Supplier",
  "Consultant",
  "Subcontractor",
  "Other",
];

const isBlank = (value) => String(value || "").trim() === "";

const validateVendorPayload = (req, res, next) => {
  const { vendorName, vendorType, mobileNumber } = req.body;

  if (isBlank(vendorName) || isBlank(vendorType)) {
    return res.status(400).json({
      success: false,
      message: "vendorName and vendorType are required",
    });
  }

  if (!allowedVendorTypes.includes(String(vendorType).trim())) {
    return res.status(400).json({
      success: false,
      message: "Invalid vendor type",
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

  next();
};

const validateVendorStatusPayload = (req, res, next) => {
  if (typeof req.body.isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be provided as true or false",
    });
  }

  next();
};

module.exports = {
  validateCreateVendorInput: validateVendorPayload,
  validateUpdateVendorInput: validateVendorPayload,
  validateVendorStatusPayload,
};
