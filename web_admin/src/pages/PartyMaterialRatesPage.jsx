import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { formatDisplayDate, getTodayDateValue } from "../utils/date";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));

const formatCompactNumber = (value, maximumFractionDigits = 4) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(numericValue);
};

const LOADING_BASIS_OPTIONS = [
  { value: "none", label: "No Loading" },
  { value: "fixed", label: "Fixed Per Dispatch" },
  { value: "per_ton", label: "Per Ton" },
  { value: "per_brass", label: "Per Brass" },
  { value: "per_trip", label: "Per Trip / Load" },
];

const BILLING_BASIS_OPTIONS = [
  { value: "per_ton", label: "Per Ton" },
  { value: "per_unit", label: "Per Unit" },
  { value: "per_trip", label: "Per Trip" },
  { value: "fixed", label: "Fixed" },
];

const getLoadingBasisLabel = (basis) =>
  LOADING_BASIS_OPTIONS.find((option) => option.value === basis)?.label || "Fixed Per Dispatch";

const getLoadingProfessionalHint = (basis) => {
  if (basis === "per_trip") {
    return "Per trip loading applies once for each dispatch load. Dispatch users can still alter the final amount manually when ground conditions differ.";
  }

  if (basis === "per_brass") {
    return "Per brass loading uses the same tons-per-brass commercial conversion that royalty uses.";
  }

  if (basis === "per_ton") {
    return "Per ton loading scales automatically with dispatch quantity.";
  }

  return "";
};

const formatLoadingChargeValue = (item) => {
  const basis = item.loadingChargeBasis || "fixed";
  const amount = formatCurrency(item.loadingCharge || 0);

  if (basis === "none") {
    return "None";
  }

  if (basis === "fixed") {
    return `${amount} / dispatch`;
  }

  if (basis === "per_trip") {
    return `${amount} / trip`;
  }

  if (basis === "per_ton") {
    return `${amount} / ton`;
  }

  if (basis === "per_brass") {
    return `${amount} / brass`;
  }

  return amount;
};

const getBillingBasisLabel = (value) =>
  BILLING_BASIS_OPTIONS.find((option) => option.value === value)?.label || "Legacy";

const LEGACY_RATE_META_BY_UNIT_CODE = {
  TON: { rateUnit: "per_ton", rateUnitLabel: "ton", rateUnitsPerTon: 1 },
  MT: { rateUnit: "per_metric_ton", rateUnitLabel: "metric ton", rateUnitsPerTon: 1 },
  CFT: { rateUnit: "per_cft", rateUnitLabel: "CFT" },
  BRASS: { rateUnit: "per_brass", rateUnitLabel: "brass" },
  CUM: { rateUnit: "per_cubic_meter", rateUnitLabel: "cubic meter" },
  TRIP: { rateUnit: "per_trip", rateUnitLabel: "trip" },
};

const LEGACY_UNIT_CODES_BY_RATE_UNIT = {
  per_ton: ["MT", "TON"],
  per_metric_ton: ["MT", "TON"],
  per_cft: ["CFT"],
  per_brass: ["BRASS"],
  per_cubic_meter: ["CUM"],
  per_trip: ["TRIP"],
};

const getListData = (response) =>
  Array.isArray(response?.data?.data) ? response.data.data : [];

const getMaterialsData = (response) =>
  Array.isArray(response?.data?.data?.materials) ? response.data.data.materials : [];

const getMaterialUnitConversionsData = (response) =>
  Array.isArray(response?.data?.data) ? response.data.data : [];

const getRateLabel = (draft, selectedBillingUnit) => {
  if (draft.billingBasis === "per_unit") {
    return `Rate (₹ / ${selectedBillingUnit?.unitCode || "Unit"})`;
  }

  if (draft.billingBasis === "per_trip") {
    return "Rate (₹ / Trip)";
  }

  if (draft.billingBasis === "fixed") {
    return "Fixed Amount";
  }

  return "Rate (₹ / MT)";
};

const getDisplayedRateValue = (draft) =>
  draft.billingBasis === "per_unit" ? draft.pricePerUnit : draft.ratePerTon;

const getMainRateNumber = (draft) =>
  draft.billingBasis === "per_unit" ? Number(draft.pricePerUnit) : Number(draft.ratePerTon);

const getSafePositiveNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const buildNormalizedKey = (value) => String(value || "").trim().toUpperCase();

const inferBillingBasisFromRate = (item) => {
  const explicitBasis = String(item?.billingBasis || "").trim();

  if (BILLING_BASIS_OPTIONS.some((option) => option.value === explicitBasis)) {
    return explicitBasis;
  }

  const normalizedRateUnit = String(item?.rateUnit || "").trim();
  const normalizedRateUnitLabel = String(item?.rateUnitLabel || "").trim().toLowerCase();

  if (normalizedRateUnit === "per_trip") {
    return "per_trip";
  }

  if (normalizedRateUnit === "other" || normalizedRateUnitLabel === "fixed amount") {
    return "fixed";
  }

  if (
    normalizedRateUnit &&
    !["per_ton", "per_metric_ton"].includes(normalizedRateUnit)
  ) {
    return "per_unit";
  }

  return "per_ton";
};

const resolveUnitFromLegacyDraft = (draft, units) => {
  const explicitUnitId = String(draft?.rateUnitId || "").trim();

  if (explicitUnitId) {
    const explicitUnit = units.find((unit) => String(unit.id) === explicitUnitId);
    if (explicitUnit) {
      return explicitUnit;
    }
  }

  const preferredCodes = LEGACY_UNIT_CODES_BY_RATE_UNIT[String(draft?.rateUnit || "").trim()] || [];
  if (preferredCodes.length > 0) {
    const matchedUnit = units.find((unit) =>
      preferredCodes.includes(buildNormalizedKey(unit.unitCode))
    );

    if (matchedUnit) {
      return matchedUnit;
    }
  }

  const normalizedLabel = String(draft?.rateUnitLabel || "").trim().toUpperCase();
  if (!normalizedLabel) {
    return null;
  }

  return (
    units.find(
      (unit) =>
        buildNormalizedKey(unit.unitCode) === normalizedLabel ||
        buildNormalizedKey(unit.unitName) === normalizedLabel
    ) || null
  );
};

function PartyMaterialRatesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasAppliedPrefillRef = useRef(false);
  const [rates, setRates] = useState([]);
  const [parties, setParties] = useState([]);
  const [plants, setPlants] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [materialUnitConversions, setMaterialUnitConversions] = useState([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unitsWarning, setUnitsWarning] = useState("");
  const [conversionsWarning, setConversionsWarning] = useState("");

  const [search, setSearch] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showList, setShowList] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(false);

  const [form, setForm] = useState({
    plantId: "",
    partyId: "",
    materialId: "",
    billingBasis: "per_ton",
    rateUnitId: "",
    pricePerUnit: "",
    conversionId: "",
    ratePerTon: "",
    rateUnit: "per_ton",
    rateUnitLabel: "",
    rateUnitsPerTon: "1",
    effectiveFrom: getTodayDateValue(),
    royaltyMode: "per_ton",
    royaltyValue: "",
    tonsPerBrass: "",
    loadingCharge: "",
    loadingChargeBasis: "fixed",
    notes: "",
  });

  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({
    plantId: "",
    partyId: "",
    materialId: "",
    billingBasis: "per_ton",
    rateUnitId: "",
    pricePerUnit: "",
    conversionId: "",
    ratePerTon: "",
    rateUnit: "per_ton",
    rateUnitLabel: "",
    rateUnitsPerTon: "1",
    effectiveFrom: getTodayDateValue(),
    royaltyMode: "per_ton",
    royaltyValue: "",
    tonsPerBrass: "",
    loadingCharge: "",
    loadingChargeBasis: "fixed",
    notes: "",
  });

  useEffect(() => {
    if (search || plantFilter || partyFilter || statusFilter) {
      const timeoutId = window.setTimeout(() => {
        setShowList(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [search, plantFilter, partyFilter, statusFilter]);

  const loadAll = useCallback(async () => {
    try {
      const [ratesRes, partiesRes, plantsRes, mastersRes, unitsRes, conversionsRes] =
        await Promise.allSettled([
        api.get("/party-material-rates"),
        api.get("/parties"),
        api.get("/plants"),
        api.get("/masters"),
        api.get("/masters/units"),
        api.get("/masters/material-unit-conversions"),
      ]);

      const requiredResponses = [ratesRes, partiesRes, plantsRes, mastersRes];
      const failedRequiredResponse = requiredResponses.find(
        (response) => response.status !== "fulfilled"
      );

      if (failedRequiredResponse) {
        throw failedRequiredResponse.reason;
      }

      setRates(getListData(ratesRes.value));
      setParties(getListData(partiesRes.value));
      setPlants(getListData(plantsRes.value));
      setMaterials(getMaterialsData(mastersRes.value));

      if (unitsRes.status === "fulfilled") {
        setUnits(getListData(unitsRes.value));
        setUnitsWarning("");
      } else {
        setUnits([]);
        setUnitsWarning(
          "Unit master data could not be loaded. Legacy party material rates are still available, but unit labels may be incomplete."
        );
      }

      if (conversionsRes.status === "fulfilled") {
        setMaterialUnitConversions(getMaterialUnitConversionsData(conversionsRes.value));
        setConversionsWarning("");
      } else {
        setMaterialUnitConversions([]);
        setConversionsWarning(
          "Material conversion master data could not be loaded. Legacy records are still available, but per unit billing guidance may be limited."
        );
      }

      setError("");
    } catch {
      setUnitsWarning("");
      setConversionsWarning("");
      setError("Failed to load party material rates data");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAll();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAll]);

  useEffect(() => {
    const prefillRate = location.state?.prefillRate;
    if (!prefillRate || hasAppliedPrefillRef.current) {
      return;
    }

    hasAppliedPrefillRef.current = true;
    const timeoutId = window.setTimeout(() => {
      setShowForm(true);
      setShowList(true);
      setForm((prev) => ({
        ...prev,
        ...prefillRate,
      }));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [location.state]);

  const returnToPartyCommercialProfile =
    location.state?.returnToPartyCommercialProfile || null;

  const filteredRates = useMemo(() => {
    return rates.filter((rate) => {
      const q = search.toLowerCase();

      const matchesSearch =
        rate.partyName?.toLowerCase().includes(q) ||
        rate.materialName?.toLowerCase().includes(q) ||
        rate.plantName?.toLowerCase().includes(q) ||
        rate.notes?.toLowerCase().includes(q);

      const matchesPlant = plantFilter
        ? String(rate.plantId) === String(plantFilter)
        : true;

      const matchesParty = partyFilter
        ? String(rate.partyId) === String(partyFilter)
        : true;

      const matchesStatus =
        statusFilter === ""
          ? true
          : statusFilter === "active"
          ? rate.isActive
          : !rate.isActive;

      return matchesSearch && matchesPlant && matchesParty && matchesStatus;
    });
  }, [rates, search, plantFilter, partyFilter, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: rates.length,
      active: rates.filter((r) => r.isActive).length,
      inactive: rates.filter((r) => !r.isActive).length,
      withRoyalty: rates.filter((r) => r.royaltyMode !== "none").length,
    };
  }, [rates]);

  const filteredSummary = useMemo(() => {
    const activeRates = filteredRates.filter((item) => item.isActive);
    const totalRateValue = activeRates.reduce(
      (sum, item) => sum + Number(item.ratePerTon || 0),
      0
    );
    const totalLoading = activeRates.reduce(
      (sum, item) => sum + Number(item.loadingCharge || 0),
      0
    );

    return {
      visible: filteredRates.length,
      activeVisible: activeRates.length,
      averageRate:
        activeRates.length > 0 ? totalRateValue / activeRates.length : 0,
      averageLoading:
        activeRates.length > 0 ? totalLoading / activeRates.length : 0,
    };
  }, [filteredRates]);

  const workspaceHealth = useMemo(() => {
    return {
      plants: plants.length,
      parties: parties.length,
      materials: materials.length,
    };
  }, [materials.length, parties.length, plants.length]);

  const commercialBrief = useMemo(() => {
    let title = "Selling-rate layer is in control";
    let text =
      "Keep party pricing, royalty defaults, and loading charges aligned here so dispatch billing stays predictable.";
    let tone = "calm";

    if (summary.inactive > 0) {
      title = "Some commercial rates are inactive";
      text = `${summary.inactive} inactive rate record(s) exist, so teams should confirm they are intentionally retired and not missing reactivation.`;
      tone = "strong";
    }

    if (filteredSummary.activeVisible === 0 && filteredRates.length > 0) {
      title = "Current view has no active commercial rates";
      text = "The current filter set only shows inactive or unavailable pricing, which is risky for live dispatch billing.";
      tone = "attention";
    }

    return { title, text, tone };
  }, [filteredRates.length, filteredSummary.activeVisible, summary.inactive]);

  const controlTiles = useMemo(
    () => [
      {
        label: "Active In View",
        value: filteredSummary.activeVisible,
        note: "Rates currently usable for dispatch billing",
        tone: filteredSummary.activeVisible > 0 ? "strong" : "attention",
      },
      {
        label: "Average Stored Rate Value",
        value: formatCurrency(filteredSummary.averageRate),
        note: "Average of the legacy compatibility rate field across active visible records. Compare only within matching billing units.",
        tone: filteredSummary.averageRate > 0 ? "strong" : "calm",
      },
      {
        label: "Average Loading",
        value: formatCurrency(filteredSummary.averageLoading),
        note: "Average loading charge across active visible rates",
        tone: filteredSummary.averageLoading > 0 ? "strong" : "calm",
      },
      {
        label: "Workspace Coverage",
        value: `${workspaceHealth.parties}/${workspaceHealth.materials}`,
        note: "Available parties versus materials in this workspace",
        tone: workspaceHealth.parties > 0 && workspaceHealth.materials > 0 ? "calm" : "attention",
      },
    ],
    [
      filteredSummary.activeVisible,
      filteredSummary.averageLoading,
      filteredSummary.averageRate,
      workspaceHealth.materials,
      workspaceHealth.parties,
    ]
  );

  const handleChange = (setter) => (e) => {
    setter((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const unitsById = useMemo(
    () => new Map(units.map((unit) => [String(unit.id), unit])),
    [units]
  );

  const materialsById = useMemo(
    () => new Map(materials.map((material) => [String(material.id), material])),
    [materials]
  );

  const activeMaterialConversions = useMemo(
    () => materialUnitConversions.filter((conversion) => conversion.isActive !== false),
    [materialUnitConversions]
  );

  const materialConversionsByMaterialId = useMemo(() => {
    const grouped = new Map();

    activeMaterialConversions.forEach((conversion) => {
      const key = String(conversion.materialId || "");
      const existing = grouped.get(key) || [];
      existing.push(conversion);
      grouped.set(key, existing);
    });

    return grouped;
  }, [activeMaterialConversions]);

  const getConversionsForMaterial = useCallback(
    (materialId) => materialConversionsByMaterialId.get(String(materialId || "")) || [],
    [materialConversionsByMaterialId]
  );

  const getMaterialContext = useCallback(
    (draft) => {
      const materialId = String(draft.materialId || "");
      const material = materialsById.get(materialId) || null;
      const conversions = getConversionsForMaterial(materialId);
      const mtUnit = units.find((unit) => ["MT", "TON"].includes(buildNormalizedKey(unit.unitCode))) || null;
      const selectedBillingUnit =
        unitsById.get(String(draft.rateUnitId || "")) ||
        resolveUnitFromLegacyDraft(draft, units) ||
        null;

      const billingUnitsMap = new Map();
      let selectedConversion = null;
      let brassToTonConversion = null;

      if (mtUnit) {
        billingUnitsMap.set(String(mtUnit.id), mtUnit);
      }

      conversions.forEach((conversion) => {
        const fromUnit = unitsById.get(String(conversion.fromUnitId || ""));
        const toUnit = unitsById.get(String(conversion.toUnitId || ""));
        const fromCode = buildNormalizedKey(fromUnit?.unitCode);
        const toCode = buildNormalizedKey(toUnit?.unitCode);

        const touchesTonSide = fromCode === "MT" || fromCode === "TON" || toCode === "MT" || toCode === "TON";

        if (touchesTonSide) {
          const derivedUnit =
            fromCode === "MT" || fromCode === "TON" ? toUnit : fromUnit;

          if (derivedUnit) {
            billingUnitsMap.set(String(derivedUnit.id), derivedUnit);
          }
        }

        if (
          selectedBillingUnit &&
          !selectedConversion &&
          (((fromCode === "MT" || fromCode === "TON") &&
            String(conversion.toUnitId) === String(selectedBillingUnit.id)) ||
            ((toCode === "MT" || toCode === "TON") &&
              String(conversion.fromUnitId) === String(selectedBillingUnit.id)))
        ) {
          selectedConversion = conversion;
        }

        if (
          !brassToTonConversion &&
          ((fromCode === "BRASS" && (toCode === "MT" || toCode === "TON")) ||
            (toCode === "BRASS" && (fromCode === "MT" || fromCode === "TON")))
        ) {
          brassToTonConversion = conversion;
        }
      });

      const availableBillingUnits = Array.from(billingUnitsMap.values()).sort((left, right) =>
        String(left.unitCode || "").localeCompare(String(right.unitCode || ""))
      );

      const preferredDefault =
        availableBillingUnits.find((unit) => buildNormalizedKey(unit.unitCode) === "CFT") ||
        availableBillingUnits.find((unit) => buildNormalizedKey(unit.unitCode) === "BRASS") ||
        availableBillingUnits.find((unit) =>
          ["MT", "TON"].includes(buildNormalizedKey(unit.unitCode))
        ) ||
        availableBillingUnits[0] ||
        null;

      let rateUnitsPerTon = 1;
      let conversionId = "";
      let conversionHint = "";
      let conversionMissing = false;

      if (draft.billingBasis === "per_unit" && selectedBillingUnit) {
        const selectedCode = buildNormalizedKey(selectedBillingUnit.unitCode);
        const storedRateUnitsPerTon = getSafePositiveNumber(draft.rateUnitsPerTon);

        if (selectedCode === "MT" || selectedCode === "TON") {
          rateUnitsPerTon = 1;
          conversionHint = `Conversion available: 1 MT = 1 ${selectedBillingUnit.unitCode}`;
        } else if (selectedConversion) {
          const fromUnit = unitsById.get(String(selectedConversion.fromUnitId || ""));
          const toUnit = unitsById.get(String(selectedConversion.toUnitId || ""));
          const fromCode = buildNormalizedKey(fromUnit?.unitCode);
          const toCode = buildNormalizedKey(toUnit?.unitCode);
          const rawFactor = Number(selectedConversion.conversionFactor);

          if (Number.isFinite(rawFactor) && rawFactor > 0) {
            if (fromCode === "MT" || fromCode === "TON") {
              rateUnitsPerTon = rawFactor;
            } else if (toCode === "MT" || toCode === "TON") {
              rateUnitsPerTon = 1 / rawFactor;
            }
          }

          conversionId = String(selectedConversion.id || "");

          if (Number.isFinite(rateUnitsPerTon) && rateUnitsPerTon > 0) {
            conversionHint = `Conversion available: 1 MT = ${formatCompactNumber(
              rateUnitsPerTon
            )} ${selectedBillingUnit.unitCode}`;
          }
        } else if (storedRateUnitsPerTon) {
          rateUnitsPerTon = storedRateUnitsPerTon;
          conversionId = String(draft.conversionId || "");
          conversionHint = `Using saved compatibility conversion: 1 MT = ${formatCompactNumber(
            storedRateUnitsPerTon
          )} ${selectedBillingUnit.unitCode}`;
        } else {
          conversionMissing = true;
        }
      }

      let tonsPerBrass = draft.tonsPerBrass;
      if (draft.royaltyMode === "per_brass" || draft.loadingChargeBasis === "per_brass") {
        const fromUnit = unitsById.get(String(brassToTonConversion?.fromUnitId || ""));
        const toUnit = unitsById.get(String(brassToTonConversion?.toUnitId || ""));
        const fromCode = buildNormalizedKey(fromUnit?.unitCode);
        const toCode = buildNormalizedKey(toUnit?.unitCode);
        const rawFactor = Number(brassToTonConversion?.conversionFactor);

        if (Number.isFinite(rawFactor) && rawFactor > 0) {
          if (fromCode === "BRASS" && (toCode === "MT" || toCode === "TON")) {
            tonsPerBrass = String(rawFactor);
          } else if (toCode === "BRASS" && (fromCode === "MT" || fromCode === "TON")) {
            tonsPerBrass = String(1 / rawFactor);
          }
        }
      }

      const unitCode = buildNormalizedKey(selectedBillingUnit?.unitCode);
      const legacyMeta =
        LEGACY_RATE_META_BY_UNIT_CODE[unitCode] ||
        (draft.billingBasis === "fixed"
          ? { rateUnit: "other", rateUnitLabel: "fixed amount", rateUnitsPerTon: 1 }
          : draft.billingBasis === "per_trip"
            ? { rateUnit: "per_trip", rateUnitLabel: "trip", rateUnitsPerTon: 1 }
            : { rateUnit: "per_ton", rateUnitLabel: "ton", rateUnitsPerTon: 1 });

      return {
        material,
        conversions,
        selectedBillingUnit,
        availableBillingUnits,
        preferredDefault,
        conversionId,
        conversionHint,
        conversionMissing,
        rateUnitsPerTon:
          Number.isFinite(rateUnitsPerTon) && rateUnitsPerTon > 0
            ? rateUnitsPerTon
            : 1,
        tonsPerBrass,
        legacyMeta,
      };
    },
    [getConversionsForMaterial, materialsById, units, unitsById]
  );

  const buildDerivedCompatibility = useCallback(
    (draft) => {
      const context = getMaterialContext(draft);
      const mainRate = getSafePositiveNumber(getMainRateNumber(draft));

      if (draft.billingBasis === "per_unit") {
        return {
          ...context,
          ratePerTon: mainRate,
          pricePerUnit: mainRate,
          rateUnit: context.legacyMeta.rateUnit,
          rateUnitLabel: context.legacyMeta.rateUnitLabel,
          rateUnitsPerTon: context.rateUnitsPerTon,
          conversionId: context.conversionId || draft.conversionId || "",
          tonsPerBrass: context.tonsPerBrass || draft.tonsPerBrass || "",
        };
      }

      if (draft.billingBasis === "per_trip") {
        return {
          ...context,
          ratePerTon: mainRate,
          pricePerUnit: mainRate,
          rateUnit: "per_trip",
          rateUnitLabel: "trip",
          rateUnitsPerTon: 1,
          conversionId: "",
          tonsPerBrass: context.tonsPerBrass || draft.tonsPerBrass || "",
        };
      }

      if (draft.billingBasis === "fixed") {
        return {
          ...context,
          ratePerTon: mainRate,
          pricePerUnit: mainRate,
          rateUnit: "other",
          rateUnitLabel: "fixed amount",
          rateUnitsPerTon: 1,
          conversionId: "",
          tonsPerBrass: context.tonsPerBrass || draft.tonsPerBrass || "",
        };
      }

      return {
        ...context,
        ratePerTon: mainRate,
        pricePerUnit: mainRate,
        rateUnit: "per_metric_ton",
        rateUnitLabel: "metric ton",
        rateUnitsPerTon: 1,
        conversionId: "",
        tonsPerBrass: context.tonsPerBrass || draft.tonsPerBrass || "",
      };
    },
    [getMaterialContext]
  );

  const formDerived = useMemo(() => buildDerivedCompatibility(form), [buildDerivedCompatibility, form]);
  const editDerived = useMemo(
    () => buildDerivedCompatibility(editForm),
    [buildDerivedCompatibility, editForm]
  );

  useEffect(() => {
    if (form.billingBasis !== "per_unit") {
      return;
    }

    const availableIds = new Set(
      formDerived.availableBillingUnits.map((unit) => String(unit.id))
    );

    if (!form.rateUnitId || !availableIds.has(String(form.rateUnitId))) {
      const nextUnitId = formDerived.preferredDefault?.id;
      if (nextUnitId) {
        setForm((prev) => ({ ...prev, rateUnitId: String(nextUnitId) }));
      }
    }
  }, [form.billingBasis, form.rateUnitId, formDerived.availableBillingUnits, formDerived.preferredDefault]);

  useEffect(() => {
    if (!editItem || editForm.billingBasis !== "per_unit") {
      return;
    }

    if (!editForm.rateUnitId) {
      const nextUnitId = editDerived.preferredDefault?.id;
      if (nextUnitId) {
        setEditForm((prev) => ({ ...prev, rateUnitId: String(nextUnitId) }));
      }
    }
  }, [
    editDerived.availableBillingUnits,
    editDerived.preferredDefault,
    editForm.billingBasis,
    editForm.rateUnitId,
    editItem,
  ]);

  const handleBillingBasisChange = (setter) => (e) => {
    const nextBasis = e.target.value;
    setter((prev) => ({
      ...prev,
      billingBasis: nextBasis,
      ...(nextBasis !== "per_unit"
        ? { rateUnitId: "", conversionId: "" }
        : {}),
    }));
  };

  const handleVisibleRateChange = (setter) => (e) => {
    const { value } = e.target;

    setter((prev) => {
      if (prev.billingBasis === "per_unit") {
        return {
          ...prev,
          pricePerUnit: value,
        };
      }

      return {
        ...prev,
        ratePerTon: value,
      };
    });
  };

  const renderCountBadge = (count) => (
    <span style={styles.countBadge}>{count} records</span>
  );

  const renderStatusBadge = (isActive) => (
    <span
      style={{
        ...styles.statusBadge,
        ...(isActive ? styles.activeBadge : styles.inactiveBadge),
      }}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );

  const formatRoyalty = (item) => {
    if (item.royaltyMode === "none") return "None";
    if (item.royaltyMode === "fixed") {
      return `Fixed (${item.royaltyValue || 0})`;
    }
    if (item.royaltyMode === "per_brass") {
      const tonsPerBrass =
        item.tonsPerBrass === null || item.tonsPerBrass === undefined || item.tonsPerBrass === ""
          ? "-"
          : item.tonsPerBrass;
      return `Per Brass (${item.royaltyValue || 0}, ${tonsPerBrass} ton/brass)`;
    }
    return `Per Ton (${item.royaltyValue || 0})`;
  };

  const validateRateForm = (data, derived) => {
    if (!data.plantId || !data.partyId || !data.materialId) {
      setError("Plant, party, and material are required");
      return false;
    }

    if (!BILLING_BASIS_OPTIONS.some((option) => option.value === data.billingBasis)) {
      setError("Please select a valid billing basis");
      return false;
    }

    if (data.billingBasis === "per_unit") {
      if (!data.rateUnitId) {
        setError("Please select a unit for per unit billing");
        return false;
      }

      if (!data.pricePerUnit || Number(data.pricePerUnit) <= 0) {
        setError("Price per unit must be greater than 0");
        return false;
      }

      if (derived.conversionMissing) {
        setError(
          "Unit conversion not defined for this material. Please configure in Masters."
        );
        return false;
      }
    }

    const visibleRate = getMainRateNumber(data);

    if (!visibleRate || Number(visibleRate) <= 0) {
      if (!(data.billingBasis === "per_unit" && data.pricePerUnit && Number(data.pricePerUnit) > 0)) {
        setError("Rate must be greater than 0");
        return false;
      }
    }

    if (!["per_ton", "per_brass", "fixed", "none"].includes(data.royaltyMode)) {
      setError("Please select a valid royalty mode");
      return false;
    }

    if (!String(data.effectiveFrom || "").trim()) {
      setError("Effective from date is required");
      return false;
    }

    if (
      data.royaltyMode !== "none" &&
      (data.royaltyValue === "" || Number(data.royaltyValue) < 0)
    ) {
      setError("Royalty value must be 0 or more");
      return false;
    }

    if (
      (data.royaltyMode === "per_brass" || data.loadingChargeBasis === "per_brass") &&
      (!derived.tonsPerBrass || Number(derived.tonsPerBrass) <= 0)
    ) {
      setError(
        "Unit conversion not defined for brass-based royalty/loading. Please configure in Masters."
      );
      return false;
    }

    if (data.loadingCharge !== "" && Number(data.loadingCharge) < 0) {
      setError("Loading charge must be 0 or more");
      return false;
    }

    return true;
  };

  const normalizePayload = (data, derived) => ({
    plantId: Number(data.plantId),
    partyId: Number(data.partyId),
    materialId: Number(data.materialId),
    billingBasis: data.billingBasis || "per_ton",
    rateUnitId:
      data.billingBasis !== "per_unit" ||
      data.rateUnitId === "" ||
      data.rateUnitId === undefined ||
      data.rateUnitId === null
        ? null
        : Number(data.rateUnitId),
    pricePerUnit:
      derived.pricePerUnit === null ||
      derived.pricePerUnit === undefined
        ? null
        : Number(derived.pricePerUnit),
    conversionId:
      !derived.conversionId
        ? null
        : Number(derived.conversionId),
    ratePerTon:
      derived.ratePerTon === null || derived.ratePerTon === undefined
        ? null
        : Number(derived.ratePerTon),
    rateUnit: derived.rateUnit || "per_ton",
    rateUnitLabel: String(derived.rateUnitLabel || "").trim(),
    rateUnitsPerTon: Number(derived.rateUnitsPerTon || 1),
    effectiveFrom: String(data.effectiveFrom || "").trim(),
    royaltyMode: data.royaltyMode,
    royaltyValue:
      data.royaltyMode === "none"
        ? 0
        : data.royaltyValue === ""
        ? 0
        : Number(data.royaltyValue),
    tonsPerBrass:
      data.royaltyMode === "per_brass" || data.loadingChargeBasis === "per_brass"
        ? !derived.tonsPerBrass
          ? null
          : Number(derived.tonsPerBrass)
        : null,
    loadingCharge:
      data.loadingChargeBasis === "none"
        ? 0
        : data.loadingCharge === ""
          ? 0
          : Number(data.loadingCharge),
    loadingChargeBasis: data.loadingChargeBasis || "fixed",
    notes: data.notes || "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateRateForm(form, formDerived)) return;

    try {
      await api.post("/party-material-rates", normalizePayload(form, formDerived));

      setSuccess("Party material rate added successfully");
      setForm({
        plantId: "",
        partyId: "",
        materialId: "",
        billingBasis: "per_ton",
        rateUnitId: "",
        pricePerUnit: "",
        conversionId: "",
        ratePerTon: "",
        rateUnit: "per_ton",
        rateUnitLabel: "",
        rateUnitsPerTon: "1",
        effectiveFrom: getTodayDateValue(),
        royaltyMode: "per_ton",
        royaltyValue: "",
        tonsPerBrass: "",
        loadingCharge: "",
        loadingChargeBasis: "fixed",
        notes: "",
      });
      setShowAdvancedForm(false);
      setShowForm(false);
      setShowList(true);
      await loadAll();

      if (returnToPartyCommercialProfile) {
        navigate(`/parties/${returnToPartyCommercialProfile}/commercial`, {
          state: {
            profileMessage: "Party material rate added successfully",
          },
        });
        return;
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to add party material rate"
      );
    }
  };

  const openEditPanel = (item) => {
    const inferredBillingBasis = inferBillingBasisFromRate(item);
    const inferredUnit = resolveUnitFromLegacyDraft(item, units);

    setEditItem(item);
    setShowAdvancedEdit(false);
    setEditForm({
      plantId: String(item.plantId || ""),
      partyId: String(item.partyId || ""),
      materialId: String(item.materialId || ""),
      ratePerTon:
        item.ratePerTon !== null && item.ratePerTon !== undefined
          ? String(item.ratePerTon)
          : "",
      billingBasis: inferredBillingBasis,
      rateUnitId:
        item.rateUnitId !== null && item.rateUnitId !== undefined
          ? String(item.rateUnitId)
          : inferredUnit
            ? String(inferredUnit.id)
          : "",
      pricePerUnit:
        item.pricePerUnit !== null && item.pricePerUnit !== undefined
          ? String(item.pricePerUnit)
          : item.ratePerTon !== null && item.ratePerTon !== undefined
            ? String(item.ratePerTon)
            : "",
      conversionId:
        item.conversionId !== null && item.conversionId !== undefined
          ? String(item.conversionId)
          : "",
      rateUnit: item.rateUnit || "per_ton",
      rateUnitLabel: item.rateUnitLabel || "",
      rateUnitsPerTon:
        item.rateUnitsPerTon !== null && item.rateUnitsPerTon !== undefined
          ? String(item.rateUnitsPerTon)
          : "1",
      effectiveFrom: item.effectiveFrom || getTodayDateValue(),
      royaltyMode: item.royaltyMode || "per_ton",
      royaltyValue:
        item.royaltyValue !== null && item.royaltyValue !== undefined
          ? String(item.royaltyValue)
          : "",
      tonsPerBrass:
        item.tonsPerBrass !== null && item.tonsPerBrass !== undefined
          ? String(item.tonsPerBrass)
          : "",
      loadingCharge:
        item.loadingCharge !== null && item.loadingCharge !== undefined
          ? String(item.loadingCharge)
          : "",
      loadingChargeBasis: item.loadingChargeBasis || "fixed",
      notes: item.notes || "",
    });
    setError("");
    setSuccess("");
  };

  const handleEditSave = async () => {
    setError("");
    setSuccess("");

    if (!editItem) return;
    if (!validateRateForm(editForm, editDerived)) return;

    try {
      await api.patch(
        `/party-material-rates/${editItem.id}`,
        normalizePayload(editForm, editDerived)
      );

      setSuccess("Party material rate updated successfully");
      setEditItem(null);
      setShowList(true);
      await loadAll();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update party material rate"
      );
    }
  };

  const handleToggleStatus = async (item) => {
    setError("");
    setSuccess("");

    try {
      await api.patch(`/party-material-rates/${item.id}/status`, {
        isActive: !item.isActive,
      });

      setSuccess(
        item.isActive
          ? "Party material rate deactivated successfully"
          : "Party material rate activated successfully"
      );
      setShowList(true);
      await loadAll();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to update party material rate status"
      );
    }
  };

  const formatPrimaryRateDisplay = (item) => {
    const resolvedBillingBasis = item.billingBasis || "per_ton";
    const resolvedUnit =
      unitsById.get(String(item.rateUnitId || ""))?.unitCode ||
      item.rateUnitLabel ||
      "unit";

    if (resolvedBillingBasis === "per_unit") {
      return `${formatCurrency(item.pricePerUnit || item.ratePerTon || 0)} / ${resolvedUnit}`;
    }

    if (resolvedBillingBasis === "per_trip") {
      return `${formatCurrency(item.pricePerUnit || item.ratePerTon || 0)} / Trip`;
    }

    if (resolvedBillingBasis === "fixed") {
      return `${formatCurrency(item.pricePerUnit || item.ratePerTon || 0)} fixed`;
    }

    return `${formatCurrency(item.pricePerUnit || item.ratePerTon || 0)} / MT`;
  };

  const renderConversionSummary = (derived) => {
    if (!derived.material) {
      return null;
    }

    if (derived.conversionMissing) {
      return (
        <div style={styles.inlineAlert}>
          Unit conversion not defined for this material. Please configure in Masters.
        </div>
      );
    }

    const optionsText =
      derived.availableBillingUnits.length > 0
        ? derived.availableBillingUnits.map((unit) => unit.unitCode).join(", ")
        : "MT";

    return (
      <div style={styles.helperPanel}>
        <div style={styles.helperTitle}>System will auto-calculate conversions based on master data</div>
        <p style={styles.helperText}>Based on current conversion master</p>
        <p style={styles.helperText}>Available billing units: {optionsText}</p>
        {derived.conversionHint ? (
          <p style={styles.helperHighlight}>{derived.conversionHint}</p>
        ) : null}
      </div>
    );
  };

  const renderAdvancedSection = (draft, derived, isOpen, setOpen) => (
    <div style={styles.advancedShell}>
      <button
        type="button"
        style={styles.advancedToggle}
        onClick={() => setOpen((prev) => !prev)}
      >
        {isOpen ? "Hide" : "Show"} Advanced / Compatibility Settings
      </button>

      {isOpen ? (
        <div style={styles.advancedPanel}>
          <div style={styles.advancedGrid}>
            <label style={styles.readOnlyField}>
              <span style={styles.readOnlyLabel}>Legacy Rate Unit</span>
              <input value={derived.rateUnit || "-"} readOnly style={styles.readOnlyInput} />
            </label>
            <label style={styles.readOnlyField}>
              <span style={styles.readOnlyLabel}>Legacy Rate Per Ton</span>
              <input
                value={derived.ratePerTon ? formatCompactNumber(derived.ratePerTon, 2) : "-"}
                readOnly
                style={styles.readOnlyInput}
              />
            </label>
            <label style={styles.readOnlyField}>
              <span style={styles.readOnlyLabel}>Rate Units Per Ton</span>
              <input
                value={derived.rateUnitsPerTon ? formatCompactNumber(derived.rateUnitsPerTon) : "-"}
                readOnly
                style={styles.readOnlyInput}
              />
            </label>
            <label style={styles.readOnlyField}>
              <span style={styles.readOnlyLabel}>Conversion Reference</span>
              <input
                value={derived.conversionId || draft.conversionId || "Auto / Not required"}
                readOnly
                style={styles.readOnlyInput}
              />
            </label>
            <label style={styles.readOnlyField}>
              <span style={styles.readOnlyLabel}>Tons Per Brass</span>
              <input
                value={derived.tonsPerBrass || draft.tonsPerBrass || "-"}
                readOnly
                style={styles.readOnlyInput}
              />
            </label>
          </div>
          <p style={styles.advancedText}>
            System will auto-calculate conversions based on master data and keep the backend compatibility payload intact.
          </p>
        </div>
      ) : null}
    </div>
  );

  return (
    <AppShell
      title="Party Material Rates"
      subtitle="Manage plant-wise, party-wise material selling rates, royalty defaults, and loading charges"
    >
      <div style={styles.pageStack}>
        <div style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.heroContent}>
            <div>
              <p style={styles.heroEyebrow}>Commercial Selling Layer</p>
              <h1 style={styles.heroTitle}>Party Material Rate Control Center</h1>
              <p style={styles.heroText}>
                Manage selling rates for each party, material, and plant with
                royalty defaults and loading charges ready for dispatch billing.
              </p>
            </div>

            <div style={styles.heroPills}>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Business Role</span>
                <strong style={styles.heroPillValue}>Customer billing engine</strong>
              </div>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Practical Design</span>
                <strong style={styles.heroPillValue}>Flexible royalty setup</strong>
              </div>
            </div>
          </div>
        </div>

        {error && <div style={styles.messageError}>{error}</div>}
        {success && <div style={styles.messageSuccess}>{success}</div>}
        {unitsWarning && <div style={styles.messageWarning}>{unitsWarning}</div>}
        {conversionsWarning && <div style={styles.messageWarning}>{conversionsWarning}</div>}

        {returnToPartyCommercialProfile && (
          <div style={styles.returnBanner}>
            <span>You opened this page from a party commercial profile.</span>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() =>
                navigate(`/parties/${returnToPartyCommercialProfile}/commercial`)
              }
            >
              Back To Party Commercial
            </button>
          </div>
        )}

        <div
          style={{
            ...styles.controlBrief,
            ...(commercialBrief.tone === "attention"
              ? styles.controlBriefAttention
              : commercialBrief.tone === "strong"
                ? styles.controlBriefStrong
                : styles.controlBriefCalm),
          }}
        >
          <div style={styles.controlBriefCopy}>
            <p style={styles.controlBriefEyebrow}>Rate Guidance</p>
            <h2 style={styles.controlBriefTitle}>{commercialBrief.title}</h2>
            <p style={styles.controlBriefText}>{commercialBrief.text}</p>
          </div>

          <div style={styles.controlBriefActions}>
            <button type="button" style={styles.button} onClick={() => setShowForm(true)}>
              Add Rate
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setStatusFilter("active")}
            >
              Focus Active
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadAll}
            >
              Refresh Rates
            </button>
          </div>
        </div>

        <div style={styles.focusTileGrid}>
          {controlTiles.map((tile) => (
            <div
              key={tile.label}
              style={{
                ...styles.focusTile,
                ...(tile.tone === "attention"
                  ? styles.focusTileAttention
                  : tile.tone === "strong"
                    ? styles.focusTileStrong
                    : styles.focusTileCalm),
              }}
            >
              <span style={styles.focusTileLabel}>{tile.label}</span>
              <strong style={styles.focusTileValue}>{tile.value}</strong>
              <p style={styles.focusTileText}>{tile.note}</p>
            </div>
          ))}
        </div>

        <SectionCard title="Overview">
          <div style={styles.summaryGrid}>
            <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
              <span style={styles.summaryTag}>Total</span>
              <p style={styles.summaryLabel}>All Party Rates</p>
              <h3 style={styles.summaryValue}>{summary.total}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Active</span>
              <p style={styles.summaryLabel}>Active Rates</p>
              <h3 style={styles.summaryValue}>{summary.active}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Inactive</span>
              <p style={styles.summaryLabel}>Inactive Rates</p>
              <h3 style={styles.summaryValue}>{summary.inactive}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Royalty</span>
              <p style={styles.summaryLabel}>Rates With Royalty</p>
              <h3 style={styles.summaryValue}>{summary.withRoyalty}</h3>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Search & Filters">
          <div style={styles.quickFilterRow}>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setStatusFilter("active");
                setPartyFilter("");
                setPlantFilter("");
              }}
            >
              Active Rates
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setStatusFilter("inactive");
                setPartyFilter("");
                setPlantFilter("");
              }}
            >
              Inactive Rates
            </button>
            <button
              type="button"
              style={styles.quickFilterButton}
              onClick={() => {
                setSearch("royalty");
                setStatusFilter("");
              }}
            >
              Royalty Setups
            </button>
          </div>

          <p style={styles.sectionSubtitle}>
            Search by party, material, plant, or notes. Filter by plant, party,
            and active status.
          </p>

          <div style={styles.form}>
            <input
              placeholder="Search party material rates"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
            />

            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Plants</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.plantName}
                </option>
              ))}
            </select>

            <select
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Parties</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.partyName}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setSearch("");
                setPlantFilter("");
                setPartyFilter("");
                setStatusFilter("");
              }}
            >
              Clear Filters
            </button>
          </div>

          <div style={styles.workspaceMetrics}>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Visible Rates</span>
              <strong style={styles.metricValue}>{filteredSummary.visible}</strong>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Active In View</span>
              <strong style={styles.metricValue}>
                {filteredSummary.activeVisible}
              </strong>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Avg Sell Rate</span>
              <strong style={styles.metricValue}>
                {formatCurrency(filteredSummary.averageRate)}
              </strong>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Avg Loading</span>
              <strong style={styles.metricValue}>
                {formatCurrency(filteredSummary.averageLoading)}
              </strong>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Commercial Readiness">
          <div style={styles.readinessStrip}>
            <div style={styles.readinessCard}>
              <span style={styles.readinessLabel}>Plants Ready</span>
              <strong style={styles.readinessValue}>{workspaceHealth.plants}</strong>
            </div>
            <div style={styles.readinessCard}>
              <span style={styles.readinessLabel}>Parties Ready</span>
              <strong style={styles.readinessValue}>{workspaceHealth.parties}</strong>
            </div>
            <div style={styles.readinessCard}>
              <span style={styles.readinessLabel}>Materials Ready</span>
              <strong style={styles.readinessValue}>
                {workspaceHealth.materials}
              </strong>
            </div>
          </div>

          <div style={styles.logicNote}>
            <div style={styles.logicTitle}>Billing Logic Reminder</div>
            <p style={styles.logicText}>
              Party material rates are the customer-facing material billing layer.
              They define selling rate, royalty treatment, and loading charge for
              the dispatch bill.
            </p>
            <p style={styles.logicText}>
              Transporter cost should be maintained separately in Transport Rates,
              so the total commercial view stays practical: material pricing here,
              transportation costing there.
            </p>
            <p style={styles.logicText}>
              Trip-based selling rates bill only in full trips. Dispatch billing
              rounds fractional trip demand upward, so keep trips-per-ton aligned
              with your agreed vehicle loading standard.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Party Material Rate Workspace">
          <div style={styles.workspaceHeader}>
            <div style={styles.workspaceTitleWrap}>
              <div style={styles.workspaceTitleRow}>
                <h3 style={styles.blockTitle}>Party Material Rate List</h3>
                {renderCountBadge(filteredRates.length)}
              </div>
              <p style={styles.blockSubtitle}>
                Review billing rates first and open the add form only when needed.
              </p>
            </div>

            <div style={styles.workspaceActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setShowList((prev) => !prev)}
              >
                {showList ? "Hide List" : "Show List"}
              </button>

              <button
                type="button"
                style={showForm ? styles.secondaryButton : styles.button}
                onClick={() => setShowForm((prev) => !prev)}
              >
                {showForm ? "Hide Form" : "Add Rate"}
              </button>
            </div>
          </div>

          {showList && (
            <>
              {filteredRates.length === 0 ? (
                <div style={styles.emptyState}>
                  <strong style={styles.emptyStateTitle}>
                    No party material rates match the current view
                  </strong>
                  <p style={styles.emptyStateText}>
                    Try clearing filters or add a new party-material combination so
                    dispatch billing has a reliable default selling rate.
                  </p>
                </div>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Plant</th>
                        <th style={styles.th}>Party</th>
                        <th style={styles.th}>Material</th>
                        <th style={styles.th}>Effective From</th>
                        <th style={styles.th}>Rate Unit</th>
                        <th style={styles.th}>Royalty</th>
                        <th style={styles.th}>Loading</th>
                        <th style={styles.th}>Notes</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRates.map((item) => (
                        <tr key={item.id}>
                          <td style={styles.td}>{item.plantName}</td>
                          <td style={styles.td}>{item.partyName}</td>
                          <td style={styles.td}>{item.materialName}</td>
                          <td style={styles.td}>
                            {item.effectiveFrom
                              ? formatDisplayDate(item.effectiveFrom)
                              : "-"}
                          </td>
                          <td style={styles.td}>
                            <div style={styles.tdSubtle}>
                              {getBillingBasisLabel(item.billingBasis)}
                            </div>
                            {formatPrimaryRateDisplay(item)}
                            {item.billingBasis === "per_unit" && Number(item.rateUnitsPerTon || 1) !== 1 ? (
                              <div style={styles.tdSubtle}>
                                Based on current conversion master: {formatCompactNumber(item.rateUnitsPerTon)}{" "}
                                {(unitsById.get(String(item.rateUnitId || ""))?.unitCode ||
                                  item.rateUnitLabel ||
                                  "unit")}{" "}
                                / MT
                              </div>
                            ) : null}
                          </td>
                          <td style={styles.td}>{formatRoyalty(item)}</td>
                          <td style={styles.td}>
                            {formatLoadingChargeValue(item)}
                            {getLoadingProfessionalHint(item.loadingChargeBasis) ? (
                              <div style={styles.tdSubtle}>
                                {getLoadingBasisLabel(item.loadingChargeBasis)}
                              </div>
                            ) : null}
                          </td>
                          <td style={styles.td}>{item.notes || "-"}</td>
                          <td style={styles.td}>
                            {renderStatusBadge(item.isActive)}
                          </td>
                          <td style={styles.td}>
                            <div style={styles.inlineActions}>
                              <button
                                type="button"
                                style={styles.smallButton}
                                onClick={() => openEditPanel(item)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                style={{
                                  ...styles.smallButton,
                                  ...(item.isActive
                                    ? styles.warnButton
                                    : styles.successButton),
                                }}
                                onClick={() => handleToggleStatus(item)}
                              >
                                {item.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {showForm && (
            <div style={styles.compactFormShell}>
              <h3 style={styles.blockTitle}>Add Party Material Rate</h3>
              <p style={styles.blockSubtitle}>
                Create a default selling rate with optional royalty and loading charge.
                System will auto-calculate conversions based on master data.
              </p>

              <form onSubmit={handleSubmit} style={styles.form}>
                <select
                  name="plantId"
                  value={form.plantId}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                >
                  <option value="">Select Plant</option>
                  {plants.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.plantName}
                    </option>
                  ))}
                </select>

                <select
                  name="partyId"
                  value={form.partyId}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                >
                  <option value="">Select Party</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.partyName}
                    </option>
                  ))}
                </select>

                <select
                  name="materialId"
                  value={form.materialId}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                >
                  <option value="">Select Material</option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.materialName}
                    </option>
                  ))}
                </select>

                <select
                  name="billingBasis"
                  value={form.billingBasis}
                  onChange={handleBillingBasisChange(setForm)}
                  style={styles.input}
                >
                  {BILLING_BASIS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {renderConversionSummary(formDerived)}

                {form.billingBasis === "per_unit" && (
                  <>
                    <select
                      name="rateUnitId"
                      value={form.rateUnitId}
                      onChange={handleChange(setForm)}
                      style={styles.input}
                    >
                      <option value="">Select Billing Unit</option>
                      {formDerived.availableBillingUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.unitCode} - {unit.unitName}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <input
                  name="effectiveFrom"
                  type="date"
                  value={form.effectiveFrom}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                />

                <input
                  name="commercialRate"
                  type="number"
                  step="0.01"
                  placeholder={getRateLabel(form, formDerived.selectedBillingUnit)}
                  value={getDisplayedRateValue(form)}
                  onChange={handleVisibleRateChange(setForm)}
                  style={styles.input}
                />

                <select
                  name="royaltyMode"
                  value={form.royaltyMode}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                >
                  <option value="per_ton">Royalty Per Ton</option>
                  <option value="per_brass">Royalty Per Brass</option>
                  <option value="fixed">Fixed Royalty</option>
                  <option value="none">No Royalty</option>
                </select>

                <input
                  name="royaltyValue"
                  type="number"
                  step="0.01"
                  placeholder={
                    form.royaltyMode === "none"
                      ? "Royalty not required"
                      : "Royalty Value"
                  }
                  value={form.royaltyValue}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                  disabled={form.royaltyMode === "none"}
                />

                {form.royaltyMode === "per_brass" && (
                  <div style={styles.helperPanel}>
                    <div style={styles.helperTitle}>Royalty conversion</div>
                    <p style={styles.helperText}>
                      Based on current conversion master
                    </p>
                    <p style={styles.helperHighlight}>
                      {formDerived.tonsPerBrass
                        ? `1 BRASS = ${formatCompactNumber(formDerived.tonsPerBrass)} MT`
                        : "Please configure BRASS conversion in Masters."}
                    </p>
                  </div>
                )}

                <select
                  name="loadingChargeBasis"
                  value={form.loadingChargeBasis}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                >
                  {LOADING_BASIS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  name="loadingCharge"
                  type="number"
                  step="0.01"
                  placeholder={`Loading ${getLoadingBasisLabel(form.loadingChargeBasis)}`}
                  value={form.loadingCharge}
                  onChange={handleChange(setForm)}
                  style={styles.input}
                  disabled={form.loadingChargeBasis === "none"}
                />

                {form.loadingChargeBasis === "per_brass" ? (
                  <div style={styles.helperPanel}>
                    <div style={styles.helperTitle}>Loading conversion</div>
                    <p style={styles.helperText}>Based on current conversion master</p>
                    <p style={styles.helperHighlight}>
                      {formDerived.tonsPerBrass
                        ? `1 BRASS = ${formatCompactNumber(formDerived.tonsPerBrass)} MT`
                        : "Please configure BRASS conversion in Masters."}
                    </p>
                  </div>
                ) : null}

                <input
                  name="notes"
                  placeholder="Notes / Commercial remarks"
                  value={form.notes}
                  onChange={handleChange(setForm)}
                  style={{ ...styles.input, gridColumn: "1 / -1" }}
                />

                <div style={styles.fullWidth}>
                  {renderAdvancedSection(
                    form,
                    formDerived,
                    showAdvancedForm,
                    setShowAdvancedForm
                  )}
                </div>

                <button type="submit" style={styles.button}>
                  Save Rate
                </button>
              </form>
            </div>
          )}
        </SectionCard>

        {editItem && (
          <SectionCard title={`Edit Rate — ${editItem.partyName}`}>
            <div style={styles.editHeader}>
              <h3 style={styles.editTitle}>Update selected party material rate</h3>
              <p style={styles.editSubtitle}>
                Edit the selling rate, royalty logic, and loading charge carefully.
                System will auto-calculate conversions based on master data.
              </p>
            </div>

            <div style={styles.form}>
              <select
                name="plantId"
                value={editForm.plantId}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                <option value="">Select Plant</option>
                {plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.plantName}
                  </option>
                ))}
              </select>

              <select
                name="partyId"
                value={editForm.partyId}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                <option value="">Select Party</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.partyName}
                  </option>
                ))}
              </select>

              <select
                name="materialId"
                value={editForm.materialId}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                <option value="">Select Material</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.materialName}
                  </option>
                ))}
              </select>

              <select
                name="billingBasis"
                value={editForm.billingBasis}
                onChange={handleBillingBasisChange(setEditForm)}
                style={styles.input}
              >
                {BILLING_BASIS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {renderConversionSummary(editDerived)}

              {editForm.billingBasis === "per_unit" && (
                <>
                  <select
                    name="rateUnitId"
                    value={editForm.rateUnitId}
                    onChange={handleChange(setEditForm)}
                    style={styles.input}
                  >
                    <option value="">Select Billing Unit</option>
                    {editDerived.availableBillingUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unitCode} - {unit.unitName}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <input
                name="effectiveFrom"
                type="date"
                value={editForm.effectiveFrom}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />

              <input
                name="commercialRate"
                type="number"
                step="0.01"
                placeholder={getRateLabel(editForm, editDerived.selectedBillingUnit)}
                value={getDisplayedRateValue(editForm)}
                onChange={handleVisibleRateChange(setEditForm)}
                style={styles.input}
              />

              <select
                name="royaltyMode"
                value={editForm.royaltyMode}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                <option value="per_ton">Royalty Per Ton</option>
                <option value="per_brass">Royalty Per Brass</option>
                <option value="fixed">Fixed Royalty</option>
                <option value="none">No Royalty</option>
              </select>

              <input
                name="royaltyValue"
                type="number"
                step="0.01"
                placeholder={
                  editForm.royaltyMode === "none"
                    ? "Royalty not required"
                    : "Royalty Value"
                }
                value={editForm.royaltyValue}
                onChange={handleChange(setEditForm)}
                style={styles.input}
                disabled={editForm.royaltyMode === "none"}
              />

              {editForm.royaltyMode === "per_brass" && (
                <div style={styles.helperPanel}>
                  <div style={styles.helperTitle}>Royalty conversion</div>
                  <p style={styles.helperText}>Based on current conversion master</p>
                  <p style={styles.helperHighlight}>
                    {editDerived.tonsPerBrass
                      ? `1 BRASS = ${formatCompactNumber(editDerived.tonsPerBrass)} MT`
                      : "Please configure BRASS conversion in Masters."}
                  </p>
                </div>
              )}

              <select
                name="loadingChargeBasis"
                value={editForm.loadingChargeBasis}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                {LOADING_BASIS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <input
                name="loadingCharge"
                type="number"
                step="0.01"
                placeholder={`Loading ${getLoadingBasisLabel(editForm.loadingChargeBasis)}`}
                value={editForm.loadingCharge}
                onChange={handleChange(setEditForm)}
                style={styles.input}
                disabled={editForm.loadingChargeBasis === "none"}
              />

              {editForm.loadingChargeBasis === "per_brass" ? (
                <div style={styles.helperPanel}>
                  <div style={styles.helperTitle}>Loading conversion</div>
                  <p style={styles.helperText}>Based on current conversion master</p>
                  <p style={styles.helperHighlight}>
                    {editDerived.tonsPerBrass
                      ? `1 BRASS = ${formatCompactNumber(editDerived.tonsPerBrass)} MT`
                      : "Please configure BRASS conversion in Masters."}
                  </p>
                </div>
              ) : null}

              <input
                name="notes"
                placeholder="Notes / Commercial remarks"
                value={editForm.notes}
                onChange={handleChange(setEditForm)}
                style={{ ...styles.input, gridColumn: "1 / -1" }}
              />

              <div style={styles.fullWidth}>
                {renderAdvancedSection(
                  editForm,
                  editDerived,
                  showAdvancedEdit,
                  setShowAdvancedEdit
                )}
              </div>
            </div>

            <div style={styles.editActions}>
              <button type="button" style={styles.button} onClick={handleEditSave}>
                Save Changes
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setEditItem(null)}
              >
                Cancel
              </button>
            </div>
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageStack: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "28px",
    padding: "28px",
    background:
      "radial-gradient(circle at top left, rgba(16,185,129,0.18), transparent 26%), radial-gradient(circle at bottom right, rgba(14,165,233,0.16), transparent 26%), linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
  },
  heroGlowOne: {
    position: "absolute",
    top: "-80px",
    right: "-40px",
    width: "220px",
    height: "220px",
    borderRadius: "999px",
    background: "rgba(16,185,129,0.18)",
    filter: "blur(36px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-90px",
    left: "-30px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(14,165,233,0.16)",
    filter: "blur(40px)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "20px",
    alignItems: "center",
  },
  heroEyebrow: {
    margin: 0,
    marginBottom: "10px",
    color: "rgba(255,255,255,0.7)",
    fontSize: "12px",
    letterSpacing: "1.8px",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: 0,
    marginBottom: "12px",
    fontSize: "34px",
    lineHeight: 1.08,
    fontWeight: "800",
    letterSpacing: "-0.03em",
  },
  heroText: {
    margin: 0,
    maxWidth: "760px",
    color: "rgba(255,255,255,0.84)",
    lineHeight: 1.7,
    fontSize: "15px",
  },
  heroPills: {
    display: "grid",
    gap: "12px",
  },
  heroPill: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px",
    padding: "16px",
    backdropFilter: "blur(8px)",
  },
  heroPillLabel: {
    display: "block",
    marginBottom: "6px",
    fontSize: "12px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.66)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  heroPillValue: {
    fontSize: "15px",
    color: "#ffffff",
  },
  controlBrief: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
    padding: "22px",
    borderRadius: "24px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 18px 38px rgba(15,23,42,0.07)",
  },
  controlBriefCalm: {
    background:
      "linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(239,246,255,0.94) 100%)",
  },
  controlBriefStrong: {
    background:
      "linear-gradient(135deg, rgba(219,234,254,0.96) 0%, rgba(255,255,255,0.96) 100%)",
  },
  controlBriefAttention: {
    background:
      "linear-gradient(135deg, rgba(255,237,213,0.98) 0%, rgba(254,242,242,0.96) 100%)",
  },
  controlBriefCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxWidth: "760px",
  },
  controlBriefEyebrow: {
    margin: 0,
    color: "#0f766e",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  controlBriefTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "28px",
    lineHeight: 1.12,
    fontWeight: "800",
    letterSpacing: "-0.03em",
  },
  controlBriefText: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.7,
  },
  controlBriefActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  focusTileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  focusTile: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "18px",
    borderRadius: "22px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 16px 34px rgba(15,23,42,0.06)",
  },
  focusTileCalm: {
    background: "linear-gradient(180deg, rgba(248,250,252,0.98), rgba(255,255,255,0.96))",
  },
  focusTileStrong: {
    background: "linear-gradient(180deg, rgba(239,246,255,0.98), rgba(255,255,255,0.96))",
  },
  focusTileAttention: {
    background: "linear-gradient(180deg, rgba(255,247,237,0.98), rgba(255,255,255,0.96))",
  },
  focusTileLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.9px",
  },
  focusTileValue: {
    color: "#0f172a",
    fontSize: "24px",
    fontWeight: "800",
    lineHeight: 1.15,
  },
  focusTileText: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
    minHeight: "40px",
  },
  messageError: {
    background: "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(239,68,68,0.08)",
  },
  messageSuccess: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
    color: "#047857",
    border: "1px solid #a7f3d0",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(16,185,129,0.08)",
  },
  messageWarning: {
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    color: "#9a3412",
    border: "1px solid #fdba74",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(245,158,11,0.08)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  summaryCard: {
    borderRadius: "22px",
    padding: "20px",
    border: "1px solid rgba(255,255,255,0.35)",
    boxShadow: "0 14px 32px rgba(15,23,42,0.06)",
  },
  summaryBlue: {
    background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)",
  },
  summaryGreen: {
    background: "linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)",
  },
  summaryAmber: {
    background: "linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)",
  },
  summaryRose: {
    background: "linear-gradient(135deg, #ffe4e6 0%, #fff1f2 100%)",
  },
  summaryTag: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.8)",
    color: "#0f172a",
    fontSize: "11px",
    fontWeight: "800",
    marginBottom: "12px",
  },
  summaryLabel: {
    margin: 0,
    marginBottom: "8px",
    color: "#475569",
    fontSize: "14px",
    fontWeight: "700",
  },
  summaryValue: {
    margin: 0,
    color: "#0f172a",
    fontSize: "32px",
    lineHeight: 1.1,
    fontWeight: "800",
  },
  sectionSubtitle: {
    margin: "0 0 16px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  quickFilterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
  },
  quickFilterButton: {
    border: "1px solid rgba(15, 118, 110, 0.16)",
    borderRadius: "999px",
    padding: "10px 14px",
    background: "rgba(240,253,250,0.92)",
    color: "#115e59",
    fontWeight: "700",
    cursor: "pointer",
  },
  workspaceMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginTop: "16px",
  },
  metricCard: {
    borderRadius: "18px",
    padding: "16px",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 28px rgba(15,23,42,0.04)",
  },
  metricLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.7px",
    textTransform: "uppercase",
    color: "#64748b",
  },
  metricValue: {
    color: "#0f172a",
    fontSize: "22px",
    lineHeight: 1.2,
    fontWeight: "800",
  },
  readinessStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "16px",
  },
  readinessCard: {
    padding: "18px",
    borderRadius: "18px",
    border: "1px solid #dbe3f0",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
  },
  readinessLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
  },
  readinessValue: {
    color: "#0f172a",
    fontSize: "26px",
    fontWeight: "800",
  },
  logicNote: {
    padding: "18px",
    borderRadius: "20px",
    background:
      "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(14,165,233,0.08) 100%)",
    border: "1px solid #bfdbfe",
  },
  logicTitle: {
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: "800",
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  logicText: {
    margin: "0 0 8px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  workspaceHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  workspaceTitleWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  workspaceTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  workspaceActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  countBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
    background: "#dcfce7",
    color: "#166534",
  },
  blockTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "18px",
    fontWeight: "800",
  },
  blockSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  compactFormShell: {
    padding: "18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e2e8f0",
    marginTop: "18px",
  },
  fullWidth: {
    gridColumn: "1 / -1",
  },
  editHeader: {
    marginBottom: "12px",
  },
  editTitle: {
    margin: "0 0 4px",
    color: "#0f172a",
    fontSize: "18px",
    fontWeight: "800",
  },
  editSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
  },
  helperPanel: {
    gridColumn: "1 / -1",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
  },
  helperTitle: {
    margin: 0,
    marginBottom: "4px",
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: "800",
  },
  helperText: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  helperHighlight: {
    margin: "6px 0 0",
    color: "#1d4ed8",
    fontSize: "13px",
    fontWeight: "700",
    lineHeight: 1.6,
  },
  inlineAlert: {
    gridColumn: "1 / -1",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #fdba74",
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    color: "#9a3412",
    fontSize: "13px",
    fontWeight: "700",
  },
  advancedShell: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  advancedToggle: {
    alignSelf: "flex-start",
    border: "1px solid #cbd5e1",
    borderRadius: "999px",
    padding: "10px 14px",
    background: "#fff",
    color: "#0f172a",
    fontWeight: "700",
    cursor: "pointer",
  },
  advancedPanel: {
    padding: "16px",
    borderRadius: "16px",
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
  },
  advancedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  readOnlyField: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  readOnlyLabel: {
    color: "#475569",
    fontSize: "12px",
    fontWeight: "700",
  },
  readOnlyInput: {
    padding: "11px 12px",
    border: "1px solid #dbe3f0",
    borderRadius: "12px",
    background: "#fff",
    color: "#0f172a",
    fontSize: "13px",
  },
  advancedText: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  button: {
    padding: "12px 16px",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "700",
    boxShadow: "0 12px 24px rgba(15,23,42,0.14)",
  },
  secondaryButton: {
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "700",
  },
  returnBanner: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: "13px",
    fontWeight: "700",
  },
  editActions: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
    flexWrap: "wrap",
  },
  inlineActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  smallButton: {
    padding: "8px 12px",
    border: "none",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700",
  },
  warnButton: {
    background: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
  },
  successButton: {
    background: "linear-gradient(135deg, #047857 0%, #059669 100%)",
  },
  statusBadge: {
    display: "inline-block",
    padding: "7px 11px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
  },
  activeBadge: {
    background: "#dcfce7",
    color: "#166534",
  },
  inactiveBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  muted: {
    color: "#6b7280",
    margin: 0,
    fontSize: "14px",
  },
  emptyState: {
    padding: "20px",
    borderRadius: "18px",
    border: "1px dashed #cbd5e1",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
  },
  emptyStateTitle: {
    display: "block",
    marginBottom: "8px",
    color: "#0f172a",
    fontSize: "15px",
  },
  emptyStateText: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: "18px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    boxShadow: "0 12px 28px rgba(15,23,42,0.04)",
    marginTop: "14px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "14px 12px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "13px",
    fontWeight: "800",
    background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "13px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
    fontSize: "14px",
    verticalAlign: "top",
  },
  tdSubtle: {
    color: "#64748b",
    fontSize: "12px",
    marginTop: "4px",
  },
};

export default PartyMaterialRatesPage;
