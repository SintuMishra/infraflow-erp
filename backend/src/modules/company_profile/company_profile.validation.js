const isBlank = (value) => String(value || "").trim() === "";

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isValidStateCode = (value) => /^[0-9]{2}$/.test(String(value || "").trim());
const isValidPincode = (value) => /^[0-9]{6}$/.test(String(value || "").trim());
const isValidGstin = (value) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/i.test(String(value || "").trim());
const isValidPan = (value) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(String(value || "").trim());
const isValidMobile = (value) => /^[0-9]{10,15}$/.test(String(value || "").trim());
const isValidIfsc = (value) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(String(value || "").trim());
const isValidLogoDataUrl = (value) =>
  /^data:image\/(?:png|jpeg|jpg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(
    String(value || "").trim()
  );
const MAX_LOGO_DATA_URL_LENGTH = 4_200_000;

const validateCompanyProfilePayload = (req, res, next) => {
  const {
    companyName,
    logoUrl,
    email,
    stateCode,
    pincode,
    gstin,
    pan,
    mobile,
    ifscCode,
  } = req.body || {};

  if (isBlank(companyName)) {
    return res.status(400).json({
      success: false,
      message: "companyName is required",
    });
  }

  if (email && !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "email must be valid",
    });
  }

  if (logoUrl) {
    if (!isValidLogoDataUrl(logoUrl)) {
      return res.status(400).json({
        success: false,
        message: "logoUrl must be a valid base64 image data URL",
      });
    }

    if (String(logoUrl).trim().length > MAX_LOGO_DATA_URL_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "logoUrl is too large; keep logo under 3MB",
      });
    }
  }

  if (stateCode && !isValidStateCode(stateCode)) {
    return res.status(400).json({
      success: false,
      message: "stateCode must be a 2-digit code",
    });
  }

  if (pincode && !isValidPincode(pincode)) {
    return res.status(400).json({
      success: false,
      message: "pincode must be a 6-digit number",
    });
  }

  if (gstin && !isValidGstin(gstin)) {
    return res.status(400).json({
      success: false,
      message: "gstin must be a valid GSTIN",
    });
  }

  if (pan && !isValidPan(pan)) {
    return res.status(400).json({
      success: false,
      message: "pan must be a valid PAN",
    });
  }

  if (mobile && !isValidMobile(mobile)) {
    return res.status(400).json({
      success: false,
      message: "mobile must be 10 to 15 digits",
    });
  }

  if (ifscCode && !isValidIfsc(ifscCode)) {
    return res.status(400).json({
      success: false,
      message: "ifscCode must be a valid IFSC code",
    });
  }

  next();
};

module.exports = {
  validateCompanyProfilePayload,
};
