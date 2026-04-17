import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";

const REQUIRED_FIELDS = ["companyName"];
const PROFILE_FIELDS = [
  "companyName",
  "logoUrl",
  "branchName",
  "addressLine1",
  "city",
  "stateName",
  "stateCode",
  "pincode",
  "gstin",
  "pan",
  "mobile",
  "email",
  "bankName",
  "bankAccount",
  "ifscCode",
  "termsNotes",
];

const UPPERCASE_FIELDS = new Set(["gstin", "pan", "ifscCode", "stateCode"]);
const NUMERIC_ONLY_FIELDS = new Set(["pincode", "stateCode", "mobile", "bankAccount"]);

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isValidStateCode = (value) => /^[0-9]{2}$/.test(String(value || "").trim());
const isValidPincode = (value) => /^[0-9]{6}$/.test(String(value || "").trim());
const isValidGstin = (value) =>
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/i.test(String(value || "").trim());
const isValidPan = (value) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(String(value || "").trim());
const isValidMobile = (value) => /^[0-9]{10,15}$/.test(String(value || "").trim());
const isValidIfsc = (value) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(String(value || "").trim());
const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const LOGO_TARGET_MAX_BYTES = 350 * 1024;
const LOGO_MAX_WIDTH = 1400;
const LOGO_MAX_HEIGHT = 420;
const LOGO_MAX_UPSCALE = 2;
const PRINT_THEME_PREMIUM = "premium";
const PRINT_THEME_CLASSIC = "classic";
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
];

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read logo file"));
    reader.readAsDataURL(file);
  });

const loadImageFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to process logo image"));
    image.src = dataUrl;
  });

const estimateDataUrlBytes = (dataUrl) => {
  const parts = String(dataUrl || "").split(",");
  if (parts.length < 2) return 0;
  const base64 = parts[1];
  const padding = (base64.match(/=+$/) || [""])[0].length;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const formatBytesToKb = (bytes) => `${Math.max(0, Math.round(bytes / 1024))} KB`;

const getCornerAverageColor = (data, width, height, sampleSize = 24) => {
  const points = [
    { startX: 0, startY: 0 },
    { startX: Math.max(0, width - sampleSize), startY: 0 },
    { startX: 0, startY: Math.max(0, height - sampleSize) },
    { startX: Math.max(0, width - sampleSize), startY: Math.max(0, height - sampleSize) },
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let count = 0;

  for (const point of points) {
    for (let y = point.startY; y < Math.min(height, point.startY + sampleSize); y += 1) {
      for (let x = point.startX; x < Math.min(width, point.startX + sampleSize); x += 1) {
        const idx = (y * width + x) * 4;
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
        a += data[idx + 3];
        count += 1;
      }
    }
  }

  if (!count) return { r: 255, g: 255, b: 255, a: 255 };
  return {
    r: r / count,
    g: g / count,
    b: b / count,
    a: a / count,
  };
};

const hasTransparentPixels = (data) => {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 245) return true;
  }
  return false;
};

const getOpaqueBounds = (ctx, width, height) => {
  const { data } = ctx.getImageData(0, 0, width, height);
  const useAlphaTrim = hasTransparentPixels(data);
  const bgColor = getCornerAverageColor(data, width, height);
  const colorTolerance = 22;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = data[idx + 3];

      const alphaContent = alpha > 8;
      const colorDistance =
        Math.abs(r - bgColor.r) + Math.abs(g - bgColor.g) + Math.abs(b - bgColor.b);
      const colorContent = alpha > 32 && colorDistance > colorTolerance;
      const isContentPixel = useAlphaTrim ? alphaContent : colorContent;

      if (isContentPixel) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { sx: 0, sy: 0, sw: width, sh: height };
  }

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const padX = Math.max(1, Math.round(contentWidth * 0.03));
  const padY = Math.max(1, Math.round(contentHeight * 0.03));
  const sx = Math.max(0, minX - padX);
  const sy = Math.max(0, minY - padY);
  const ex = Math.min(width - 1, maxX + padX);
  const ey = Math.min(height - 1, maxY + padY);

  return {
    sx,
    sy,
    sw: Math.max(1, ex - sx + 1),
    sh: Math.max(1, ey - sy + 1),
  };
};

const optimizeRasterLogo = async (file) => {
  const sourceDataUrl = await readFileAsDataURL(file);
  const image = await loadImageFromDataUrl(sourceDataUrl);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.max(1, image.width);
  sourceCanvas.height = Math.max(1, image.height);
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) {
    throw new Error("Could not process logo. Please try another image.");
  }
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const bounds = getOpaqueBounds(sourceCtx, sourceCanvas.width, sourceCanvas.height);
  const scale = Math.min(
    LOGO_MAX_WIDTH / bounds.sw,
    LOGO_MAX_HEIGHT / bounds.sh,
    LOGO_MAX_UPSCALE
  );
  const width = Math.max(1, Math.round(bounds.sw * scale));
  const height = Math.max(1, Math.round(bounds.sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not optimize logo. Please try another image.");
  }
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, bounds.sx, bounds.sy, bounds.sw, bounds.sh, 0, 0, width, height);

  const isPhotoLike = file.type === "image/jpeg" || file.type === "image/jpg";
  const preferredType = isPhotoLike ? "image/jpeg" : "image/webp";
  const qualitySteps = [0.92, 0.86, 0.8, 0.74, 0.68];
  let bestDataUrl = canvas.toDataURL(preferredType, qualitySteps[0]);
  let bestSize = estimateDataUrlBytes(bestDataUrl);

  for (const quality of qualitySteps.slice(1)) {
    if (bestSize <= LOGO_TARGET_MAX_BYTES) break;
    const candidate = canvas.toDataURL(preferredType, quality);
    const candidateSize = estimateDataUrlBytes(candidate);
    if (candidateSize < bestSize) {
      bestDataUrl = candidate;
      bestSize = candidateSize;
    }
  }

  if (bestSize > LOGO_MAX_SIZE_BYTES) {
    throw new Error("Optimized logo is still too large. Please use a smaller image.");
  }

  return {
    dataUrl: bestDataUrl,
    originalBytes: file.size,
    optimizedBytes: bestSize,
    width,
    height,
  };
};

const normalizeInputByField = (fieldName, fieldValue) => {
  let normalized = fieldValue;

  if (NUMERIC_ONLY_FIELDS.has(fieldName)) {
    normalized = normalized.replace(/[^0-9]/g, "");
  }
  if (UPPERCASE_FIELDS.has(fieldName)) {
    normalized = normalized.toUpperCase();
  }

  return normalized;
};

const formatDateDisplay = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function CompanyProfilePage() {
  const logoInputRef = useRef(null);
  const [form, setForm] = useState({
    companyName: "",
    logoUrl: "",
    branchName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateName: "",
    stateCode: "",
    pincode: "",
    gstin: "",
    pan: "",
    mobile: "",
    email: "",
    bankName: "",
    bankAccount: "",
    ifscCode: "",
    termsNotes: "",
  });

  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPersistingLogo, setIsPersistingLogo] = useState(false);
  const [printTheme, setPrintTheme] = useState(PRINT_THEME_PREMIUM);
  const [isOptimizingLogo, setIsOptimizingLogo] = useState(false);
  const [logoProcessingText, setLogoProcessingText] = useState("");
  const [isLogoDragActive, setIsLogoDragActive] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const profileCompletion = useMemo(() => {
    const filled = PROFILE_FIELDS.filter((fieldName) => String(form[fieldName] || "").trim()).length;
    const total = PROFILE_FIELDS.length;
    const completionPercent = Math.round((filled / total) * 100);

    const requiredFilled = REQUIRED_FIELDS.filter((fieldName) =>
      String(form[fieldName] || "").trim()
    ).length;

    return {
      filled,
      total,
      completionPercent,
      requiredFilled,
      requiredTotal: REQUIRED_FIELDS.length,
    };
  }, [form]);

  async function loadProfile() {
    setIsLoading(true);
    try {
      const res = await api.get("/company-profile");
      if (res.data?.data) {
        const profile = res.data.data;
        setForm({
          companyName: profile.companyName || "",
          logoUrl: profile.logoUrl || "",
          branchName: profile.branchName || "",
          addressLine1: profile.addressLine1 || "",
          addressLine2: profile.addressLine2 || "",
          city: profile.city || "",
          stateName: profile.stateName || "",
          stateCode: profile.stateCode || "",
          pincode: profile.pincode || "",
          gstin: profile.gstin || "",
          pan: profile.pan || "",
          mobile: profile.mobile || "",
          email: profile.email || "",
          bankName: profile.bankName || "",
          bankAccount: profile.bankAccount || "",
          ifscCode: profile.ifscCode || "",
          termsNotes: profile.termsNotes || "",
        });
        setLastUpdatedAt(profile.updatedAt || "");
      }
      setError("");
    } catch {
      setError("Failed to load company profile");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadProfile();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: normalizeInputByField(name, value),
    }));
  };

  const validateBeforeSubmit = () => {
    if (!String(form.companyName || "").trim()) {
      return "Company Name is required";
    }

    if (form.email.trim() && !isValidEmail(form.email)) {
      return "Please enter a valid email address";
    }
    if (form.stateCode.trim() && !isValidStateCode(form.stateCode)) {
      return "State Code must be a 2-digit number";
    }
    if (form.pincode.trim() && !isValidPincode(form.pincode)) {
      return "Pincode must be a 6-digit number";
    }
    if (form.gstin.trim() && !isValidGstin(form.gstin)) {
      return "Please enter a valid GSTIN";
    }
    if (form.pan.trim() && !isValidPan(form.pan)) {
      return "Please enter a valid PAN";
    }
    if (form.mobile.trim() && !isValidMobile(form.mobile)) {
      return "Mobile must be 10 to 15 digits";
    }
    if (form.ifscCode.trim() && !isValidIfsc(form.ifscCode)) {
      return "Please enter a valid IFSC code";
    }
    if (form.logoUrl && !String(form.logoUrl).startsWith("data:image/")) {
      return "Company logo format is invalid. Please upload again.";
    }

    return "";
  };

  const buildProfilePayload = (sourceForm) => ({
    ...sourceForm,
    companyName: String(sourceForm.companyName || "").trim(),
    logoUrl: String(sourceForm.logoUrl || "").trim(),
    branchName: String(sourceForm.branchName || "").trim(),
    addressLine1: String(sourceForm.addressLine1 || "").trim(),
    addressLine2: String(sourceForm.addressLine2 || "").trim(),
    city: String(sourceForm.city || "").trim(),
    stateName: String(sourceForm.stateName || "").trim(),
    stateCode: String(sourceForm.stateCode || "").trim(),
    pincode: String(sourceForm.pincode || "").trim(),
    gstin: String(sourceForm.gstin || "").trim().toUpperCase(),
    pan: String(sourceForm.pan || "").trim().toUpperCase(),
    mobile: String(sourceForm.mobile || "").trim(),
    email: String(sourceForm.email || "").trim(),
    bankName: String(sourceForm.bankName || "").trim(),
    bankAccount: String(sourceForm.bankAccount || "").trim(),
    ifscCode: String(sourceForm.ifscCode || "").trim().toUpperCase(),
    termsNotes: String(sourceForm.termsNotes || "").trim(),
  });

  const persistLogoImmediately = async (nextFormWithLogo) => {
    if (!String(nextFormWithLogo.companyName || "").trim()) {
      setSuccess("Logo attached. Add Company Name and click Save to persist this profile.");
      return;
    }

    try {
      setIsPersistingLogo(true);
      const payload = buildProfilePayload(nextFormWithLogo);
      const res = await api.post("/company-profile", payload);
      setLastUpdatedAt(res.data?.data?.updatedAt || "");
      setSuccess("Logo saved successfully");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Logo was attached but could not be persisted. Please click Save Company Profile."
      );
    } finally {
      setIsPersistingLogo(false);
    }
  };

  const processLogoFile = async (file) => {
    if (!file) return;

    setError("");
    setSuccess("");

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setError("Logo must be PNG, JPG, WEBP, or SVG");
      return;
    }

    if (file.size > LOGO_MAX_SIZE_BYTES) {
      setError("Logo file size should be under 2MB");
      return;
    }

    try {
      setIsOptimizingLogo(true);
      setLogoProcessingText("Validating and preparing logo...");
      if (file.type === "image/svg+xml") {
        setLogoProcessingText("Processing SVG logo...");
        const svgDataUrl = await readFileAsDataURL(file);
        let nextForm = null;
        setForm((prev) => {
          nextForm = {
            ...prev,
            logoUrl: svgDataUrl,
          };
          return nextForm;
        });
        setSuccess(`SVG logo uploaded (${formatBytesToKb(file.size)})`);
        if (nextForm) {
          await persistLogoImmediately(nextForm);
        }
        return;
      }

      setLogoProcessingText("Optimizing raster logo for fast print/PDF...");
      const { dataUrl, originalBytes, optimizedBytes, width, height } = await optimizeRasterLogo(file);
      let nextForm = null;
      setForm((prev) => {
        nextForm = {
          ...prev,
          logoUrl: dataUrl,
        };
        return nextForm;
      });
      const savedBytes = Math.max(0, originalBytes - optimizedBytes);
      if (savedBytes > 0) {
        setSuccess(
          `Logo optimized to ${width}x${height} (${formatBytesToKb(optimizedBytes)}; saved ${formatBytesToKb(savedBytes)})`
        );
      } else {
        setSuccess(`Logo uploaded at ${width}x${height} (${formatBytesToKb(optimizedBytes)})`);
      }
      if (nextForm) {
        await persistLogoImmediately(nextForm);
      }
    } catch (uploadError) {
      setError(uploadError.message || "Failed to process logo file");
    } finally {
      setIsOptimizingLogo(false);
      setLogoProcessingText("");
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    await processLogoFile(file);
    event.target.value = "";
  };

  const handleLogoDrop = async (event) => {
    event.preventDefault();
    setIsLogoDragActive(false);
    if (isOptimizingLogo || isPersistingLogo || isLoading) return;
    const file = event.dataTransfer?.files?.[0];
    await processLogoFile(file);
  };

  const handleLogoDragOver = (event) => {
    event.preventDefault();
    if (!isOptimizingLogo && !isPersistingLogo && !isLoading) {
      setIsLogoDragActive(true);
    }
  };

  const handleLogoDragLeave = (event) => {
    event.preventDefault();
    setIsLogoDragActive(false);
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({
      ...prev,
      logoUrl: "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSaving(true);
      const payload = buildProfilePayload(form);

      const res = await api.post("/company-profile", payload);
      setLastUpdatedAt(res.data?.data?.updatedAt || "");
      setSuccess("Company profile saved successfully");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save company profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintProfile = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Popup blocked. Please allow popups to print/save PDF.");
      return;
    }

    const companyName = escapeHtml(form.companyName || "Company Name");
    const logoUrl = String(form.logoUrl || "").trim();
    const safeLogoTag = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="Company Logo" class="logo-image" />`
      : `<div class="logo-placeholder">Company Logo</div>`;
    const branchName = escapeHtml(form.branchName || "");
    const address = escapeHtml(
      [form.addressLine1, form.addressLine2, form.city, form.stateName, form.pincode]
        .filter(Boolean)
        .join(", ")
    );
    const contact = escapeHtml(
      [form.mobile ? `Mobile: ${form.mobile}` : "", form.email ? `Email: ${form.email}` : ""]
        .filter(Boolean)
        .join(" | ")
    );
    const tax = escapeHtml(
      [form.gstin ? `GSTIN: ${form.gstin}` : "", form.pan ? `PAN: ${form.pan}` : ""]
        .filter(Boolean)
        .join(" | ")
    );
    const bank = escapeHtml(
      [
        form.bankName ? `Bank: ${form.bankName}` : "",
        form.bankAccount ? `A/C: ${form.bankAccount}` : "",
        form.ifscCode ? `IFSC: ${form.ifscCode}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    );
    const termsNotes = escapeHtml(form.termsNotes || "No terms/notes configured.");
    const generatedAt = escapeHtml(
      new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())
    );
    const isPremiumTheme = printTheme === PRINT_THEME_PREMIUM;
    const pageMargin = isPremiumTheme ? "12mm" : "10mm";
    const sheetBorderRadius = isPremiumTheme ? "14px" : "8px";
    const headerBackground = isPremiumTheme
      ? "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
      : "#ffffff";
    const titleFontSize = isPremiumTheme ? "29px" : "24px";
    const logoPanelWidth = isPremiumTheme ? "292px" : "260px";
    const logoPanelRadius = isPremiumTheme ? "12px" : "8px";
    const cardRadius = isPremiumTheme ? "12px" : "8px";
    const accentBar = isPremiumTheme
      ? `<div class="top-accent"></div>`
      : `<div class="top-accent top-accent-classic"></div>`;
    const metaStrip = isPremiumTheme
      ? `<div class="meta-strip">
          ${form.gstin ? `<span class="chip">GSTIN: ${escapeHtml(form.gstin)}</span>` : ""}
          ${form.pan ? `<span class="chip">PAN: ${escapeHtml(form.pan)}</span>` : ""}
          ${form.mobile ? `<span class="chip">MOBILE: ${escapeHtml(form.mobile)}</span>` : ""}
        </div>`
      : "";
    const printThemeLabel = isPremiumTheme ? "Premium Letterhead" : "Classic Letterhead";

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Company Profile - ${companyName}</title>
    <style>
      @page {
        size: A4;
        margin: ${pageMargin};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #0f172a;
        background: #ffffff;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      }
      .sheet {
        min-height: calc(297mm - 24mm);
        border: 1px solid #d5deea;
        border-radius: ${sheetBorderRadius};
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .top-accent {
        height: 10px;
        background: linear-gradient(90deg, #0f172a 0%, #1e3a8a 55%, #0f766e 100%);
      }
      .top-accent-classic {
        height: 6px;
        background: #1e293b;
      }
      .header {
        padding: 18px 20px 14px;
        border-bottom: 1px solid #e2e8f0;
        background: ${headerBackground};
      }
      .header-main {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
      }
      .identity {
        min-width: 0;
      }
      .title {
        margin: 0;
        font-size: ${titleFontSize};
        line-height: 1.15;
        font-weight: 800;
        letter-spacing: 0.01em;
        color: #0f172a;
      }
      .branch {
        margin: 7px 0 0 0;
        font-size: 14px;
        color: #334155;
        font-weight: 600;
      }
      .logo-panel {
        width: ${logoPanelWidth};
        height: 108px;
        border: 1px solid #cbd5e1;
        border-radius: ${logoPanelRadius};
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
        flex-shrink: 0;
      }
      .logo-image {
        width: auto;
        height: auto;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        display: block;
      }
      .logo-placeholder {
        color: #94a3b8;
        font-size: 12px;
        font-weight: 600;
      }
      .meta-strip {
        margin-top: 12px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .chip {
        border: 1px solid #dbe2ef;
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: #334155;
        background: #ffffff;
      }
      .content {
        padding: 16px 20px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        flex: 1;
        align-content: start;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: ${cardRadius};
        padding: 12px 13px;
        background: #ffffff;
      }
      .card.full {
        grid-column: 1 / -1;
      }
      .label {
        margin: 0 0 7px 0;
        font-size: 11px;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 800;
      }
      .value {
        margin: 0;
        font-size: 14px;
        line-height: 1.55;
        color: #0f172a;
      }
      .foot {
        border-top: 1px solid #e2e8f0;
        padding: 10px 20px 12px;
        font-size: 12px;
        color: #64748b;
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .spacer {
        flex: 1;
      }
      .signature-row {
        padding: 8px 20px 12px;
        display: flex;
        justify-content: flex-end;
      }
      .signature-box {
        width: 220px;
        border-top: 1px solid #94a3b8;
        padding-top: 6px;
        text-align: center;
        color: #475569;
        font-size: 12px;
        font-weight: 600;
      }
      @media print {
        .sheet {
          border-radius: 0;
          border-color: #cbd5e1;
        }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      ${accentBar}
      <header class="header">
        <div class="header-main">
          <div class="identity">
            <h1 class="title">${companyName}</h1>
            <p class="branch">${branchName || "Primary Branch"}</p>
          </div>
          <div class="logo-panel">${safeLogoTag}</div>
        </div>
        ${metaStrip}
      </header>

      <section class="content">
        <div class="card full">
          <p class="label">Registered Address</p>
          <p class="value">${address || "-"}</p>
        </div>
        <div class="card">
          <p class="label">Contact</p>
          <p class="value">${contact || "-"}</p>
        </div>
        <div class="card">
          <p class="label">Tax Identity</p>
          <p class="value">${tax || "-"}</p>
        </div>
        <div class="card full">
          <p class="label">Banking Information</p>
          <p class="value">${bank || "-"}</p>
        </div>
        <div class="card full">
          <p class="label">Terms & Notes</p>
          <p class="value">${termsNotes}</p>
        </div>
      </section>

      <div class="spacer"></div>
      <div class="signature-row">
        <div class="signature-box">Authorized Signatory</div>
      </div>
      <footer class="foot">
        <span>Generated on ${generatedAt}</span>
        <span>${printThemeLabel}</span>
      </footer>
    </div>
    <script>
      window.onload = () => {
        window.print();
      };
    </script>
  </body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    printWindow.location.href = blobUrl;

    window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60_000);
  };

  return (
    <AppShell
      title="Company Profile"
      subtitle="Premium profile setup for invoice, compliance, and finance-ready documentation"
    >
      <div style={styles.pageStack}>
        <section style={styles.heroCard}>
          <div>
            <h3 style={styles.heroTitle}>Company Identity Hub</h3>
            <p style={styles.heroSubtitle}>
              Keep legal, billing, and banking details complete for polished operations.
            </p>
            <p style={styles.heroMeta}>
              Last updated: {formatDateDisplay(lastUpdatedAt)}
            </p>
          </div>

          <div style={styles.progressBlock}>
            <p style={styles.progressLabel}>Profile Completion</p>
            <p style={styles.progressValue}>{profileCompletion.completionPercent}%</p>
            <div style={styles.progressTrack}>
              <span
                style={{
                  ...styles.progressFill,
                  width: `${profileCompletion.completionPercent}%`,
                }}
              />
            </div>
            <p style={styles.progressMeta}>
              {profileCompletion.filled}/{profileCompletion.total} fields completed
            </p>
          </div>
        </section>

        {error && <div style={styles.messageError}>{error}</div>}
        {success && <div style={styles.messageSuccess}>{success}</div>}

        <form onSubmit={handleSubmit} style={styles.formLayout}>
          <SectionCard title="Business Identity">
            <div style={styles.formGrid}>
              <div style={styles.fieldBlockWide}>
                <label style={styles.label}>Company Name *</label>
                <input
                  name="companyName"
                  placeholder="Ex: Sintu Infra Projects Private Limited"
                  value={form.companyName}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.fieldBlockWide}>
                <label style={styles.label}>Company Logo</label>
                <div
                  style={
                    isLogoDragActive
                      ? { ...styles.logoDropZone, ...styles.logoDropZoneActive }
                      : styles.logoDropZone
                  }
                  onDragOver={handleLogoDragOver}
                  onDragEnter={handleLogoDragOver}
                  onDragLeave={handleLogoDragLeave}
                  onDrop={handleLogoDrop}
                >
                  <p style={styles.logoDropTitle}>Drop logo here or choose file</p>
                  <p style={styles.logoDropSub}>
                    PNG, JPG, WEBP, SVG | Max 2MB | Auto-trimmed + optimized for print
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    style={styles.hiddenFileInput}
                    disabled={isOptimizingLogo || isPersistingLogo || isLoading}
                  />
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isOptimizingLogo || isPersistingLogo || isLoading}
                  >
                    Choose Logo
                  </button>
                </div>
                <div style={styles.logoRow}>
                  <input
                    readOnly
                    value={
                      isPersistingLogo
                        ? "Saving logo..."
                        : isOptimizingLogo
                        ? logoProcessingText || "Optimizing logo..."
                        : form.logoUrl
                          ? "Logo attached"
                          : "No logo selected"
                    }
                    style={styles.fileStatusInput}
                  />
                  {form.logoUrl && (
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={handleRemoveLogo}
                      disabled={isOptimizingLogo || isPersistingLogo || isLoading}
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
                {isOptimizingLogo ? (
                  <p style={styles.logoHint}>Optimizing logo for fast print and PDF...</p>
                ) : isPersistingLogo ? (
                  <p style={styles.logoHint}>Saving logo to company profile...</p>
                ) : null}
                {form.logoUrl ? (
                  <div style={styles.logoPreviewCard}>
                    <img src={form.logoUrl} alt="Company Logo Preview" style={styles.logoPreviewImage} />
                  </div>
                ) : (
                  <p style={styles.logoHint}>Recommended: transparent PNG/SVG with tight logo edges (less empty padding).</p>
                )}
              </div>

              <div>
                <label style={styles.label}>Branch Name</label>
                <input
                  name="branchName"
                  placeholder="Ex: Mohda Plant Office"
                  value={form.branchName}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>GSTIN</label>
                <input
                  name="gstin"
                  placeholder="Ex: 09ABCDE1234F1Z5"
                  value={form.gstin}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>PAN</label>
                <input
                  name="pan"
                  placeholder="Ex: ABCDE1234F"
                  value={form.pan}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Address & Contact">
            <div style={styles.formGrid}>
              <div style={styles.fieldBlockWide}>
                <label style={styles.label}>Address Line 1</label>
                <input
                  name="addressLine1"
                  placeholder="Ex: Plot 17, Industrial Belt"
                  value={form.addressLine1}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldBlockWide}>
                <label style={styles.label}>Address Line 2</label>
                <input
                  name="addressLine2"
                  placeholder="Ex: Near Crusher Weighbridge"
                  value={form.addressLine2}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>City</label>
                <input
                  name="city"
                  placeholder="Ex: Prayagraj"
                  value={form.city}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>State Name</label>
                <input
                  name="stateName"
                  placeholder="Ex: Uttar Pradesh"
                  value={form.stateName}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>State Code</label>
                <input
                  name="stateCode"
                  placeholder="Ex: 09"
                  value={form.stateCode}
                  onChange={handleChange}
                  style={styles.input}
                  maxLength={2}
                />
              </div>

              <div>
                <label style={styles.label}>Pincode</label>
                <input
                  name="pincode"
                  placeholder="Ex: 211001"
                  value={form.pincode}
                  onChange={handleChange}
                  style={styles.input}
                  maxLength={6}
                />
              </div>

              <div>
                <label style={styles.label}>Mobile</label>
                <input
                  name="mobile"
                  placeholder="Ex: 9876543210"
                  value={form.mobile}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="Ex: accounts@sintuinfra.com"
                  value={form.email}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Banking & Terms">
            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>Bank Name</label>
                <input
                  name="bankName"
                  placeholder="Ex: State Bank of India"
                  value={form.bankName}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Bank Account Number</label>
                <input
                  name="bankAccount"
                  placeholder="Ex: 123456789012"
                  value={form.bankAccount}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>IFSC Code</label>
                <input
                  name="ifscCode"
                  placeholder="Ex: SBIN0001234"
                  value={form.ifscCode}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldBlockWide}>
                <label style={styles.label}>Terms & Notes</label>
                <textarea
                  name="termsNotes"
                  placeholder="Ex: Payment due within 15 days from invoice date."
                  value={form.termsNotes}
                  onChange={handleChange}
                  style={styles.textarea}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Print Preview Snapshot">
            <div style={styles.previewCard}>
              {form.logoUrl ? (
                <div style={styles.previewLogoWrap}>
                  <img src={form.logoUrl} alt="Logo Preview" style={styles.previewLogo} />
                </div>
              ) : null}
              <p style={styles.previewCompanyName}>
                {form.companyName || "Company Name"}
              </p>
              <p style={styles.previewLine}>
                {form.branchName || "Branch Name"}
              </p>
              <p style={styles.previewLine}>
                {[form.addressLine1, form.addressLine2, form.city, form.stateName]
                  .filter(Boolean)
                  .join(", ") || "Address will appear here"}
              </p>
              <p style={styles.previewLine}>
                {[form.pincode ? `PIN ${form.pincode}` : "", form.mobile ? `M: ${form.mobile}` : "", form.email]
                  .filter(Boolean)
                  .join(" | ") || "Contact details"}
              </p>
              <p style={styles.previewLine}>
                {[form.gstin ? `GSTIN: ${form.gstin}` : "", form.pan ? `PAN: ${form.pan}` : ""]
                  .filter(Boolean)
                  .join(" | ") || "Tax identity"}
              </p>
              <p style={styles.previewLine}>
                {[form.bankName, form.bankAccount ? `A/C ${form.bankAccount}` : "", form.ifscCode ? `IFSC ${form.ifscCode}` : ""]
                  .filter(Boolean)
                  .join(" | ") || "Banking details"}
              </p>
            </div>
          </SectionCard>

          <div style={styles.saveBar}>
            <div style={styles.saveActions}>
              <div style={styles.themeToggleWrap}>
                <button
                  type="button"
                  style={
                    printTheme === PRINT_THEME_PREMIUM
                      ? { ...styles.themeToggleButton, ...styles.themeToggleButtonActive }
                      : styles.themeToggleButton
                  }
                  onClick={() => setPrintTheme(PRINT_THEME_PREMIUM)}
                  disabled={isLoading || isOptimizingLogo || isPersistingLogo}
                >
                  Premium Print
                </button>
                <button
                  type="button"
                  style={
                    printTheme === PRINT_THEME_CLASSIC
                      ? { ...styles.themeToggleButton, ...styles.themeToggleButtonNoDivider, ...styles.themeToggleButtonActive }
                      : { ...styles.themeToggleButton, ...styles.themeToggleButtonNoDivider }
                  }
                  onClick={() => setPrintTheme(PRINT_THEME_CLASSIC)}
                  disabled={isLoading || isOptimizingLogo || isPersistingLogo}
                >
                  Classic Print
                </button>
              </div>
              <button
                type="submit"
                style={isSaving || isLoading || isPersistingLogo ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
                disabled={isSaving || isLoading || isPersistingLogo}
              >
                {isSaving ? "Saving..." : "Save Company Profile"}
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={handlePrintProfile}
                disabled={isLoading || isOptimizingLogo || isPersistingLogo}
              >
                Print / Save PDF
              </button>
            </div>
            <p style={styles.saveHint}>
              Required filled: {profileCompletion.requiredFilled}/{profileCompletion.requiredTotal} | Theme: {printTheme === PRINT_THEME_PREMIUM ? "Premium" : "Classic"}
            </p>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

const styles = {
  pageStack: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  heroCard: {
    padding: "22px",
    borderRadius: "18px",
    background:
      "linear-gradient(120deg, rgba(15,23,42,0.96) 0%, rgba(30,64,175,0.94) 54%, rgba(14,116,144,0.92) 100%)",
    color: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    boxShadow: "0 16px 36px rgba(15, 23, 42, 0.22)",
  },
  heroTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "800",
    letterSpacing: "0.01em",
  },
  heroSubtitle: {
    margin: "8px 0 0 0",
    color: "#dbeafe",
    fontSize: "14px",
  },
  heroMeta: {
    margin: "8px 0 0 0",
    color: "#cbd5e1",
    fontSize: "12px",
  },
  progressBlock: {
    width: "260px",
    minWidth: "220px",
    padding: "14px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  progressLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#e2e8f0",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontWeight: "700",
  },
  progressValue: {
    margin: "6px 0 8px 0",
    fontSize: "24px",
    fontWeight: "800",
    color: "#ffffff",
  },
  progressTrack: {
    width: "100%",
    height: "8px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  progressFill: {
    display: "block",
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #22d3ee 0%, #86efac 100%)",
  },
  progressMeta: {
    margin: "8px 0 0 0",
    fontSize: "12px",
    color: "#dbeafe",
  },
  messageError: {
    background: "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: "12px 14px",
    borderRadius: "12px",
    fontSize: "14px",
  },
  messageSuccess: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
    color: "#047857",
    border: "1px solid #a7f3d0",
    padding: "12px 14px",
    borderRadius: "12px",
    fontSize: "14px",
  },
  formLayout: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  fieldBlockWide: {
    gridColumn: "1 / -1",
  },
  label: {
    display: "block",
    marginBottom: "7px",
    color: "#334155",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    background: "#ffffff",
  },
  textarea: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    background: "#ffffff",
    minHeight: "96px",
    resize: "vertical",
  },
  previewCard: {
    border: "1px solid #dbeafe",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    borderRadius: "14px",
    padding: "16px",
    boxShadow: "inset 0 0 0 1px rgba(226,232,240,0.4)",
  },
  logoRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  logoDropZone: {
    border: "1px dashed #93c5fd",
    background: "linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%)",
    borderRadius: "12px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    transition: "all 0.16s ease",
  },
  logoDropZoneActive: {
    borderColor: "#2563eb",
    background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
    boxShadow: "0 0 0 3px rgba(37,99,235,0.12)",
  },
  logoDropTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
  },
  logoDropSub: {
    margin: 0,
    fontSize: "12px",
    color: "#475569",
  },
  hiddenFileInput: {
    display: "none",
  },
  fileStatusInput: {
    width: "100%",
    maxWidth: "360px",
    padding: "10px 12px",
    border: "1px solid #dbe3f0",
    borderRadius: "10px",
    background: "#f8fafc",
    color: "#334155",
    fontSize: "13px",
  },
  logoPreviewCard: {
    marginTop: "10px",
    border: "1px dashed #93c5fd",
    borderRadius: "12px",
    background: "#eff6ff",
    width: "fit-content",
    padding: "10px 12px",
  },
  logoPreviewImage: {
    maxWidth: "260px",
    maxHeight: "120px",
    objectFit: "contain",
    display: "block",
  },
  logoHint: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: "12px",
  },
  previewLogoWrap: {
    marginBottom: "10px",
  },
  previewLogo: {
    maxWidth: "240px",
    maxHeight: "96px",
    objectFit: "contain",
    display: "block",
  },
  previewCompanyName: {
    margin: "0 0 6px 0",
    fontSize: "18px",
    fontWeight: "800",
    color: "#0f172a",
  },
  previewLine: {
    margin: "0 0 6px 0",
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1.55,
  },
  saveBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  button: {
    padding: "12px 18px",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  secondaryButton: {
    padding: "12px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: "700",
  },
  saveActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  themeToggleWrap: {
    display: "inline-flex",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    overflow: "hidden",
    background: "#ffffff",
  },
  themeToggleButton: {
    padding: "11px 14px",
    border: "none",
    borderRight: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: "700",
    cursor: "pointer",
  },
  themeToggleButtonNoDivider: {
    borderRight: "none",
  },
  themeToggleButtonActive: {
    background: "#0f172a",
    color: "#ffffff",
  },
  saveHint: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
  },
};

export default CompanyProfilePage;
