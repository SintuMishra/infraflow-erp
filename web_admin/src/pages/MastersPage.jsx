import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useAuth } from "../hooks/useAuth";
import { useMasters } from "../hooks/useMasters";
import { api } from "../services/api";

const formatMetric = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const normalizeMaterialHint = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const includesAnyMaterialHint = (value, fragments) =>
  fragments.some((fragment) => value.includes(fragment));

const getSuggestedMaterialHsnSac = ({ materialName, category, rules = [] }) => {
  return getSuggestedMaterialHsnSacFromRules({
    materialName,
    category,
    rules,
  });
};

const getSuggestedMaterialHsnSacFromRules = ({
  materialName,
  category,
  rules = [],
}) => {
  const combined = `${normalizeMaterialHint(materialName)} ${normalizeMaterialHint(category)}`.trim();

  if (!combined) {
    return null;
  }

  for (const rule of rules) {
    const pattern = normalizeMaterialHint(rule?.optionLabel);
    const code = String(rule?.optionValue || "").trim();

    if (!pattern || !code) {
      continue;
    }

    if (combined.includes(pattern)) {
      return {
        code,
        label: `Config rule: ${rule.optionLabel}`,
      };
    }
  }

  if (includesAnyMaterialHint(combined, ["cement", "opc", "ppc", "white cement"])) {
    return {
      code: "2523",
      label: "Cement",
    };
  }

  if (includesAnyMaterialHint(combined, ["sand", "plaster sand", "river sand"])) {
    return {
      code: "2505",
      label: "Natural sand",
    };
  }

  if (
    includesAnyMaterialHint(combined, [
      "aggregate",
      "agregate",
      "gravel",
      "crushed stone",
      "crusher dust",
      "stone dust",
      "dust",
      "gsb",
      "road metal",
      "metal",
    ])
  ) {
    return {
      code: "2517",
      label: "Aggregates / crushed stone",
    };
  }

  if (includesAnyMaterialHint(combined, ["tmt", "rebar", "reinforcement bar", "steel bar"])) {
    return {
      code: "7214",
      label: "TMT / reinforcement bars",
    };
  }

  if (includesAnyMaterialHint(combined, ["brick", "fly ash brick", "clay brick"])) {
    return {
      code: "6901",
      label: "Bricks",
    };
  }

  return null;
};

const sectionFilterLabels = {
  all: "All master sections",
  plants: "Plants & Units",
  crusherUnits: "Sub Plants & Units",
  materials: "Materials",
  unitMasters: "Unit Master",
  materialUnitConversions: "Material Unit Conversions",
  shifts: "Shifts",
  vehicleTypes: "Vehicle Types",
  configOptions: "Config Options",
};

function MastersPage() {
  const { currentUser } = useAuth();
  const canManageMasters = ["super_admin", "manager", "hr"].includes(
    String(currentUser?.role || "")
  );

  const {
    masters,
    loadingMasters,
    refreshingMasters,
    mastersError,
    mastersLoadedAt,
    reloadMasters,
  } = useMasters();

  const [plants, setPlants] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningAutoHsn, setIsRunningAutoHsn] = useState(false);
  const [loadingHealthCheck, setLoadingHealthCheck] = useState(false);
  const [statusUpdatingKey, setStatusUpdatingKey] = useState("");
  const [mastersHealth, setMastersHealth] = useState({
    counts: {
      materialsMissingHsnSac: 0,
      materialsInvalidGstRate: 0,
      activeMaterialHsnRules: 0,
      activePlantTypes: 0,
      activePowerSources: 0,
    },
    issues: [],
  });

  const [openPanels, setOpenPanels] = useState({
    config: false,
    plant: false,
    crusherUnit: false,
    material: false,
    unitMaster: false,
    materialUnitConversion: false,
    shift: false,
    vehicleType: false,
  });

  const [listVisibility, setListVisibility] = useState({
    configOptions: false,
    plants: false,
    crusherUnits: false,
    materials: false,
    unitMasters: false,
    materialUnitConversions: false,
    shifts: false,
    vehicleTypes: false,
  });

  const [globalSearch, setGlobalSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [crusherUnitForm, setCrusherUnitForm] = useState({
    unitName: "",
    unitCode: "",
    location: "",
    plantType: "",
    plantTypeCustom: "",
    powerSourceType: "",
    powerSourceTypeCustom: "",
  });

  const [materialForm, setMaterialForm] = useState({
    materialName: "",
    materialCode: "",
    hsnSacCode: "",
    category: "",
    categoryCustom: "",
    unit: "",
    unitCustom: "",
    gstRate: "5",
  });

  const [shiftForm, setShiftForm] = useState({
    shiftName: "",
    startTime: "",
    endTime: "",
  });

  const [units, setUnits] = useState([]);
  const [materialUnitConversions, setMaterialUnitConversions] = useState([]);

  const [unitForm, setUnitForm] = useState({
    unitCode: "",
    unitName: "",
    dimensionType: "weight",
    precisionScale: "3",
    isBaseUnit: "false",
    isActive: "true",
  });

  const [materialUnitConversionForm, setMaterialUnitConversionForm] = useState({
    materialId: "",
    fromUnitId: "",
    toUnitId: "",
    conversionFactor: "",
    conversionMethod: "standard",
    effectiveFrom: "",
    effectiveTo: "",
    notes: "",
    isActive: "true",
  });

  const [vehicleTypeForm, setVehicleTypeForm] = useState({
    typeName: "",
    category: "",
    categoryCustom: "",
  });

  const [plantForm, setPlantForm] = useState({
    plantName: "",
    plantCode: "",
    plantType: "",
    plantTypeCustom: "",
    location: "",
    powerSourceType: "",
    powerSourceTypeCustom: "",
  });

  const [configForm, setConfigForm] = useState({
    configType: "plant_type",
    optionLabel: "",
    optionValue: "",
    sortOrder: "",
  });

  const [editState, setEditState] = useState({
    section: "",
    id: "",
    values: {},
  });

  const safeMasters = {
    crusherUnits: masters?.crusherUnits || [],
    materials: masters?.materials || [],
    shifts: masters?.shifts || [],
    vehicleTypes: masters?.vehicleTypes || [],
    configOptions: masters?.configOptions || {
      plantTypes: [],
      powerSources: [],
      materialCategories: [],
      materialUnits: [],
      vehicleCategories: [],
      materialHsnRules: [],
      employeeDepartments: [],
      procurementItemCategories: [],
    },
  };

  const plantTypes = useMemo(
    () => safeMasters.configOptions.plantTypes || [],
    [safeMasters.configOptions.plantTypes]
  );
  const powerSources = useMemo(
    () => safeMasters.configOptions.powerSources || [],
    [safeMasters.configOptions.powerSources]
  );
  const materialCategories = useMemo(
    () => safeMasters.configOptions.materialCategories || [],
    [safeMasters.configOptions.materialCategories]
  );
  const materialUnits = useMemo(
    () => safeMasters.configOptions.materialUnits || [],
    [safeMasters.configOptions.materialUnits]
  );
  const vehicleCategories = useMemo(
    () => safeMasters.configOptions.vehicleCategories || [],
    [safeMasters.configOptions.vehicleCategories]
  );
  const materialHsnRules = useMemo(
    () => safeMasters.configOptions.materialHsnRules || [],
    [safeMasters.configOptions.materialHsnRules]
  );
  const employeeDepartments = useMemo(
    () => safeMasters.configOptions.employeeDepartments || [],
    [safeMasters.configOptions.employeeDepartments]
  );
  const procurementItemCategories = useMemo(
    () => safeMasters.configOptions.procurementItemCategories || [],
    [safeMasters.configOptions.procurementItemCategories]
  );

  const allConfigOptions = useMemo(
    () => [
      ...plantTypes,
      ...powerSources,
      ...materialCategories,
      ...materialUnits,
      ...vehicleCategories,
      ...materialHsnRules,
      ...employeeDepartments,
      ...procurementItemCategories,
    ],
    [
      plantTypes,
      powerSources,
      materialCategories,
      materialUnits,
      vehicleCategories,
      materialHsnRules,
      employeeDepartments,
      procurementItemCategories,
    ]
  );

  const scopedUnits = useMemo(() => units || [], [units]);
  const scopedMaterialUnitConversions = useMemo(
    () => materialUnitConversions || [],
    [materialUnitConversions]
  );

  const materialsById = useMemo(
    () =>
      new Map(
        safeMasters.materials.map((material) => [String(material.id), material])
      ),
    [safeMasters.materials]
  );

  const unitsById = useMemo(
    () => new Map(scopedUnits.map((unit) => [String(unit.id), unit])),
    [scopedUnits]
  );

  async function loadPlants() {
    try {
      const res = await api.get("/plants");
      setPlants(res.data?.data || []);
      setError("");
    } catch {
      setError("Failed to load plants");
    }
  }

  async function loadUnits() {
    try {
      const res = await api.get("/masters/units");
      setUnits(res.data?.data || []);
      setError("");
    } catch {
      setError("Failed to load unit master");
    }
  }

  async function loadMaterialUnitConversions() {
    try {
      const res = await api.get("/masters/material-unit-conversions");
      setMaterialUnitConversions(res.data?.data || []);
      setError("");
    } catch {
      setError("Failed to load material unit conversions");
    }
  }

  async function loadMastersHealthCheck() {
    setLoadingHealthCheck(true);
    try {
      const res = await api.get("/masters/health-check");
      setMastersHealth(
        res.data?.data || {
          counts: {
            materialsMissingHsnSac: 0,
            materialsInvalidGstRate: 0,
            activeMaterialHsnRules: 0,
            activePlantTypes: 0,
            activePowerSources: 0,
          },
          issues: [],
        }
      );
      setError("");
    } catch {
      setError("Failed to load master health diagnostics");
    } finally {
      setLoadingHealthCheck(false);
    }
  }

  async function refreshWorkspace() {
    setIsRefreshing(true);

    try {
      await Promise.all([
        reloadMasters(),
        loadPlants(),
        loadMastersHealthCheck(),
        loadUnits(),
        loadMaterialUnitConversions(),
      ]);
      setError("");
    } catch {
      setError("Failed to refresh master workspace");
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsRefreshing(true);
      Promise.all([
        loadPlants(),
        loadMastersHealthCheck(),
        loadUnits(),
        loadMaterialUnitConversions(),
      ])
        .then(() => {
          setError("");
        })
        .catch(() => {
          setError("Failed to refresh master workspace");
        })
        .finally(() => {
          setIsRefreshing(false);
        });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const runAutoFillMaterialHsnSac = async () => {
    if (!canManageMasters) {
      setError("This role can review masters, but cannot auto-fill HSN/SAC.");
      setSuccess("");
      return;
    }

    clearMessages();
    setIsRunningAutoHsn(true);
    try {
      const res = await api.post("/masters/materials/auto-fill-hsn");
      const report = res.data?.data || {};
      const updatedCount = Number(report.updatedCount || 0);
      const skippedCount = Number(report.skippedCount || 0);
      setSuccess(
        `HSN/SAC auto-fill completed. Updated ${updatedCount} material${updatedCount === 1 ? "" : "s"}${skippedCount > 0 ? `, skipped ${skippedCount}` : ""}.`
      );
      await Promise.all([reloadMasters(), loadMastersHealthCheck()]);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to auto-fill HSN/SAC codes");
    } finally {
      setIsRunningAutoHsn(false);
    }
  };

  const togglePanel = (key) => {
    setOpenPanels((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleListVisibility = (key) => {
    setListVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAllLists = () => {
    setListVisibility({
      configOptions: true,
      plants: true,
      crusherUnits: true,
      materials: true,
      unitMasters: true,
      materialUnitConversions: true,
      shifts: true,
      vehicleTypes: true,
    });
  };

  const collapseAllLists = () => {
    setListVisibility({
      configOptions: false,
      plants: false,
      crusherUnits: false,
      materials: false,
      unitMasters: false,
      materialUnitConversions: false,
      shifts: false,
      vehicleTypes: false,
    });
  };

  const summary = useMemo(() => {
    return {
      plants: plants.length || 0,
      crusherUnits: safeMasters.crusherUnits.length || 0,
      materials: safeMasters.materials.length || 0,
      unitMasters: scopedUnits.length || 0,
      materialUnitConversions: scopedMaterialUnitConversions.length || 0,
      shifts: safeMasters.shifts.length || 0,
      vehicleTypes: safeMasters.vehicleTypes.length || 0,
      configOptions: allConfigOptions.length || 0,
    };
  }, [
    plants,
    safeMasters.crusherUnits.length,
    safeMasters.materials.length,
    scopedUnits.length,
    scopedMaterialUnitConversions.length,
    safeMasters.shifts.length,
    safeMasters.vehicleTypes.length,
    allConfigOptions.length,
  ]);

  const hasActiveFilters = Boolean(
    globalSearch.trim() || sectionFilter !== "all" || statusFilter !== "all"
  );

  const mastersSyncLabel = mastersLoadedAt
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(mastersLoadedAt))
    : "Waiting for first sync";

  const normalize = (value) => String(value || "").toLowerCase();

  const filteredPlants = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    return plants.filter(
      (plant) => {
        const matchesSearch =
          !q ||
          [
            plant.plantName,
            plant.plantCode,
            plant.plantType,
            plant.location,
            plant.powerSourceType,
          ].some((field) => normalize(field).includes(q));

        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "active"
            ? plant.isActive
            : !plant.isActive;

        return matchesSearch && matchesStatus;
      }
    );
  }, [plants, globalSearch, statusFilter]);

  const filteredCrusherUnits = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    return safeMasters.crusherUnits.filter(
      (unit) => {
        const matchesSearch =
          !q ||
          [
            unit.unitName,
            unit.unitCode,
            unit.location,
            unit.plantType,
            unit.powerSourceType,
          ].some((field) => normalize(field).includes(q));

        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "active"
            ? unit.isActive
            : !unit.isActive;

        return matchesSearch && matchesStatus;
      }
    );
  }, [safeMasters.crusherUnits, globalSearch, statusFilter]);

  const filteredMaterials = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    return safeMasters.materials.filter(
      (material) => {
        const matchesSearch =
          !q ||
          [
            material.materialName,
            material.materialCode,
            material.hsnSacCode,
            material.category,
            material.unit,
            material.gstRate,
          ].some((field) => normalize(field).includes(q));

        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "active"
            ? material.isActive
            : !material.isActive;

        return matchesSearch && matchesStatus;
      }
    );
  }, [safeMasters.materials, globalSearch, statusFilter]);

  const materialsMissingHsnSac = useMemo(
    () =>
      safeMasters.materials.filter(
        (material) =>
          material.isActive && !String(material.hsnSacCode || "").trim()
      ).length,
    [safeMasters.materials]
  );

  const materialFormSuggestedHsnSac = useMemo(
    () =>
      getSuggestedMaterialHsnSac({
        materialName: materialForm.materialName,
        category:
          materialForm.category === "__other__"
            ? materialForm.categoryCustom
            : materialForm.category,
        rules: materialHsnRules,
      }),
    [
      materialForm.category,
      materialForm.categoryCustom,
      materialForm.materialName,
      materialHsnRules,
    ]
  );

  const editSuggestedMaterialHsnSac = useMemo(
    () =>
      editState.section === "materials"
        ? getSuggestedMaterialHsnSac({
            materialName: editState.values.materialName,
            category:
              editState.values.category === "__other__"
                ? editState.values.categoryCustom
                : editState.values.category,
            rules: materialHsnRules,
          })
        : null,
    [
      editState.section,
      editState.values.category,
      editState.values.categoryCustom,
      editState.values.materialName,
      materialHsnRules,
    ]
  );

  const filteredShifts = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    return safeMasters.shifts.filter(
      (shift) => {
        const matchesSearch =
          !q ||
          [shift.shiftName, shift.startTime, shift.endTime].some((field) =>
            normalize(field).includes(q)
          );

        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "active"
            ? shift.isActive
            : !shift.isActive;

        return matchesSearch && matchesStatus;
      }
    );
  }, [safeMasters.shifts, globalSearch, statusFilter]);

  const filteredUnits = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    return scopedUnits.filter((unit) => {
      const matchesSearch =
        !q ||
        [
          unit.unitCode,
          unit.unitName,
          unit.dimensionType,
          unit.precisionScale,
          unit.isBaseUnit ? "base" : "derived",
        ].some((field) => normalize(field).includes(q));

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? unit.isActive
            : !unit.isActive;

      return matchesSearch && matchesStatus;
    });
  }, [scopedUnits, globalSearch, statusFilter]);

  const filteredMaterialUnitConversions = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    return scopedMaterialUnitConversions.filter((conversion) => {
      const materialName =
        conversion.materialName ||
        materialsById.get(String(conversion.materialId))?.materialName ||
        "";
      const fromUnit =
        conversion.fromUnitCode ||
        unitsById.get(String(conversion.fromUnitId))?.unitCode ||
        "";
      const toUnit =
        conversion.toUnitCode ||
        unitsById.get(String(conversion.toUnitId))?.unitCode ||
        "";

      const matchesSearch =
        !q ||
        [
          materialName,
          fromUnit,
          toUnit,
          conversion.conversionMethod,
          conversion.conversionFactor,
          conversion.notes,
          conversion.effectiveFrom,
          conversion.effectiveTo,
        ].some((field) => normalize(field).includes(q));

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? conversion.isActive
            : !conversion.isActive;

      return matchesSearch && matchesStatus;
    });
  }, [
    scopedMaterialUnitConversions,
    materialsById,
    unitsById,
    globalSearch,
    statusFilter,
  ]);

  const filteredVehicleTypes = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    return safeMasters.vehicleTypes.filter(
      (type) => {
        const matchesSearch =
          !q ||
          [type.typeName, type.category].some((field) =>
            normalize(field).includes(q)
          );

        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "active"
            ? type.isActive
            : !type.isActive;

        return matchesSearch && matchesStatus;
      }
    );
  }, [safeMasters.vehicleTypes, globalSearch, statusFilter]);

  const filteredConfigOptions = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    return allConfigOptions.filter(
      (option) => {
        const matchesSearch =
          !q ||
          [
            option.configType,
            option.optionLabel,
            option.optionValue,
            option.sortOrder,
          ].some((field) => normalize(field).includes(q));

        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "active"
            ? option.isActive
            : !option.isActive;

        return matchesSearch && matchesStatus;
      }
    );
  }, [allConfigOptions, globalSearch, statusFilter]);

  useEffect(() => {
    const hasSearch = globalSearch.trim().length > 0;

    if (sectionFilter !== "all") {
      setListVisibility({
        configOptions: sectionFilter === "configOptions",
        plants: sectionFilter === "plants",
        crusherUnits: sectionFilter === "crusherUnits",
        materials: sectionFilter === "materials",
        unitMasters: sectionFilter === "unitMasters",
        materialUnitConversions: sectionFilter === "materialUnitConversions",
        shifts: sectionFilter === "shifts",
        vehicleTypes: sectionFilter === "vehicleTypes",
      });
      return;
    }

    if (!hasSearch) {
      setListVisibility((prev) => ({
        ...prev,
        configOptions: false,
        plants: false,
        crusherUnits: false,
        materials: false,
        unitMasters: false,
        materialUnitConversions: false,
        shifts: false,
        vehicleTypes: false,
      }));
      return;
    }

    setListVisibility({
      configOptions: filteredConfigOptions.length > 0,
      plants: filteredPlants.length > 0,
      crusherUnits: filteredCrusherUnits.length > 0,
      materials: filteredMaterials.length > 0,
      unitMasters: filteredUnits.length > 0,
      materialUnitConversions: filteredMaterialUnitConversions.length > 0,
      shifts: filteredShifts.length > 0,
      vehicleTypes: filteredVehicleTypes.length > 0,
    });
  }, [
    sectionFilter,
    globalSearch,
    filteredConfigOptions.length,
    filteredPlants.length,
    filteredCrusherUnits.length,
    filteredMaterials.length,
    filteredUnits.length,
    filteredMaterialUnitConversions.length,
    filteredShifts.length,
    filteredVehicleTypes.length,
  ]);

  const filteredSummary = useMemo(
    () => ({
      sectionsVisible: [
        filteredPlants.length,
        filteredCrusherUnits.length,
        filteredMaterials.length,
        filteredUnits.length,
        filteredMaterialUnitConversions.length,
        filteredShifts.length,
        filteredVehicleTypes.length,
        filteredConfigOptions.length,
      ].filter((count) => count > 0).length,
      totalVisibleRecords:
        filteredPlants.length +
        filteredCrusherUnits.length +
        filteredMaterials.length +
        filteredUnits.length +
        filteredMaterialUnitConversions.length +
        filteredShifts.length +
        filteredVehicleTypes.length +
        filteredConfigOptions.length,
      activePlantCount: plants.filter((plant) => plant.isActive).length,
      activeMaterialCount: safeMasters.materials.filter((item) => item.isActive).length,
      activeConfigCount: allConfigOptions.filter((item) => item.isActive).length,
    }),
    [
      filteredPlants.length,
      filteredCrusherUnits.length,
      filteredMaterials.length,
      filteredUnits.length,
      filteredMaterialUnitConversions.length,
      filteredShifts.length,
      filteredVehicleTypes.length,
      filteredConfigOptions.length,
      plants,
      safeMasters.materials,
      allConfigOptions,
    ]
  );

  const shouldShowSection = (key) =>
    sectionFilter === "all" || sectionFilter === key;

  const handleChange = (setter) => (e) => {
    setter((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const resetWorkspaceView = () => {
    setGlobalSearch("");
    setSectionFilter("all");
    setStatusFilter("all");
    setOpenPanels({
      config: false,
      plant: false,
      crusherUnit: false,
      material: false,
      unitMaster: false,
      materialUnitConversion: false,
      shift: false,
      vehicleType: false,
    });
    setListVisibility({
      configOptions: false,
      plants: false,
      crusherUnits: false,
      materials: false,
      unitMasters: false,
      materialUnitConversions: false,
      shifts: false,
      vehicleTypes: false,
    });
    closeEditPanel();
    clearMessages();
  };

  const severityStyles = {
    warning: {
      background: "#fef3c7",
      color: "#92400e",
      borderColor: "#fcd34d",
    },
    info: {
      background: "#dbeafe",
      color: "#1d4ed8",
      borderColor: "#93c5fd",
    },
    critical: {
      background: "#fee2e2",
      color: "#b91c1c",
      borderColor: "#fecaca",
    },
  };

  const getSeverityStyle = (severity) =>
    severityStyles[String(severity || "").toLowerCase()] || severityStyles.info;

  const resolveOtherValue = (selectedValue, customValue) =>
    selectedValue === "__other__" ? customValue.trim() : selectedValue;

  const handleCreate = async ({
    url,
    payload,
    successMessage,
    reset,
    afterSuccess,
  }) => {
    if (!canManageMasters) {
      setError("This role has read-only access to masters.");
      setSuccess("");
      return;
    }

    clearMessages();

    try {
      setIsSaving(true);
      await api.post(url, payload);
      setSuccess(successMessage);
      reset();
      await reloadMasters();

      if (afterSuccess) {
        await afterSuccess();
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save data");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditPanel = (section, item) => {
    const values = { ...item };

    if (section === "shifts") {
      values.startTime = values.startTime ? String(values.startTime).slice(0, 5) : "";
      values.endTime = values.endTime ? String(values.endTime).slice(0, 5) : "";
    }

    if (section === "plants") {
      values.plantTypeCustom = "";
      values.powerSourceTypeCustom = "";
    }

    if (section === "crusherUnits") {
      values.plantTypeCustom = "";
      values.powerSourceTypeCustom = "";
    }

    if (section === "materials") {
      values.hsnSacCode = values.hsnSacCode || "";
      values.categoryCustom = "";
      values.unitCustom = "";
      values.gstRate =
        values.gstRate !== null && values.gstRate !== undefined
          ? String(values.gstRate)
          : "5";
    }

    if (section === "vehicleTypes") {
      values.categoryCustom = "";
    }

    if (section === "unitMasters") {
      values.precisionScale =
        values.precisionScale !== null && values.precisionScale !== undefined
          ? String(values.precisionScale)
          : "3";
      values.isBaseUnit = values.isBaseUnit ? "true" : "false";
      values.isActive = values.isActive ? "true" : "false";
    }

    if (section === "materialUnitConversions") {
      values.materialId =
        values.materialId !== null && values.materialId !== undefined
          ? String(values.materialId)
          : "";
      values.fromUnitId =
        values.fromUnitId !== null && values.fromUnitId !== undefined
          ? String(values.fromUnitId)
          : "";
      values.toUnitId =
        values.toUnitId !== null && values.toUnitId !== undefined
          ? String(values.toUnitId)
          : "";
      values.conversionFactor =
        values.conversionFactor !== null && values.conversionFactor !== undefined
          ? String(values.conversionFactor)
          : "";
      values.effectiveFrom = values.effectiveFrom || "";
      values.effectiveTo = values.effectiveTo || "";
      values.notes = values.notes || "";
      values.isActive = values.isActive ? "true" : "false";
    }

    setEditState({
      section,
      id: item.id,
      values,
    });

    clearMessages();
  };

  const closeEditPanel = () => {
    setEditState({
      section: "",
      id: "",
      values: {},
    });
  };

  const handleEditValueChange = (e) => {
    setEditState((prev) => ({
      ...prev,
      values: {
        ...prev.values,
        [e.target.name]: e.target.value,
      },
    }));
  };

  const handleSaveEdit = async () => {
    if (!canManageMasters) {
      setError("This role has read-only access to masters.");
      setSuccess("");
      return;
    }

    clearMessages();

    try {
      setIsSaving(true);
      if (editState.section === "plants") {
        const finalPlantType = resolveOtherValue(
          editState.values.plantType,
          editState.values.plantTypeCustom || ""
        );
        const finalPowerSourceType = resolveOtherValue(
          editState.values.powerSourceType,
          editState.values.powerSourceTypeCustom || ""
        );

        await api.patch(`/plants/${editState.id}`, {
          plantName: editState.values.plantName,
          plantCode: editState.values.plantCode,
          plantType: finalPlantType,
          location: editState.values.location,
          powerSourceType: finalPowerSourceType,
        });

        setSuccess("Plant / unit updated successfully");
        closeEditPanel();
        await loadPlants();
        return;
      }

      if (editState.section === "configOptions") {
        await api.patch(`/masters/config-options/${editState.id}`, {
          configType: editState.values.configType,
          optionLabel: editState.values.optionLabel,
          optionValue: editState.values.optionValue || editState.values.optionLabel,
          sortOrder:
            editState.values.sortOrder === "" || editState.values.sortOrder === undefined
              ? 0
              : Number(editState.values.sortOrder),
        });
      }

      if (editState.section === "crusherUnits") {
        const finalPlantType = resolveOtherValue(
          editState.values.plantType,
          editState.values.plantTypeCustom || ""
        );
        const finalPowerSourceType = resolveOtherValue(
          editState.values.powerSourceType,
          editState.values.powerSourceTypeCustom || ""
        );

        await api.patch(`/masters/crusher-units/${editState.id}`, {
          unitName: editState.values.unitName,
          unitCode: editState.values.unitCode,
          location: editState.values.location,
          plantType: finalPlantType,
          powerSourceType: finalPowerSourceType,
        });
      }

      if (editState.section === "materials") {
        const finalCategory = resolveOtherValue(
          editState.values.category,
          editState.values.categoryCustom || ""
        );
        const finalUnit = resolveOtherValue(
          editState.values.unit,
          editState.values.unitCustom || ""
        );

        await api.patch(`/masters/materials/${editState.id}`, {
          materialName: editState.values.materialName,
          materialCode: editState.values.materialCode,
          hsnSacCode: editState.values.hsnSacCode,
          category: finalCategory,
          unit: finalUnit,
          gstRate: Number(editState.values.gstRate || 0),
        });
      }

      if (editState.section === "shifts") {
        await api.patch(`/masters/shifts/${editState.id}`, {
          shiftName: editState.values.shiftName,
          startTime: editState.values.startTime,
          endTime: editState.values.endTime,
        });
      }

      if (editState.section === "vehicleTypes") {
        const finalCategory = resolveOtherValue(
          editState.values.category,
          editState.values.categoryCustom || ""
        );

        await api.patch(`/masters/vehicle-types/${editState.id}`, {
          typeName: editState.values.typeName,
          category: finalCategory,
        });
      }

      if (editState.section === "unitMasters") {
        await api.patch(`/masters/units/${editState.id}`, {
          unitCode: editState.values.unitCode,
          unitName: editState.values.unitName,
          dimensionType: editState.values.dimensionType,
          precisionScale: Number(editState.values.precisionScale || 0),
          isBaseUnit: editState.values.isBaseUnit === "true",
          isActive: editState.values.isActive === "true",
        });
      }

      if (editState.section === "materialUnitConversions") {
        await api.patch(`/masters/material-unit-conversions/${editState.id}`, {
          materialId: Number(editState.values.materialId),
          fromUnitId: Number(editState.values.fromUnitId),
          toUnitId: Number(editState.values.toUnitId),
          conversionFactor: Number(editState.values.conversionFactor),
          conversionMethod: editState.values.conversionMethod,
          effectiveFrom: editState.values.effectiveFrom,
          effectiveTo: editState.values.effectiveTo || null,
          notes: editState.values.notes,
          isActive: editState.values.isActive === "true",
        });
      }

      setSuccess("Master record updated successfully");
      closeEditPanel();
      await Promise.all([reloadMasters(), loadUnits(), loadMaterialUnitConversions()]);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update record");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (section, item) => {
    if (!canManageMasters) {
      setError("This role has read-only access to masters.");
      setSuccess("");
      return;
    }

    clearMessages();
    setStatusUpdatingKey(`${section}-${item.id}`);

    try {
      if (section === "plants") {
        await api.patch(`/plants/${item.id}/status`, {
          isActive: !item.isActive,
        });

        setSuccess(
          item.isActive
            ? "Plant / unit deactivated successfully"
            : "Plant / unit activated successfully"
        );
        await loadPlants();
        return;
      }

      if (section === "configOptions") {
        await api.patch(`/masters/config-options/${item.id}/status`, {
          isActive: !item.isActive,
        });

        setSuccess(
          item.isActive
            ? "Configuration option deactivated successfully"
            : "Configuration option activated successfully"
        );
        await reloadMasters();
        return;
      }

      if (section === "crusherUnits") {
        await api.patch(`/masters/crusher-units/${item.id}/status`, {
          isActive: !item.isActive,
        });
      }

      if (section === "materials") {
        await api.patch(`/masters/materials/${item.id}/status`, {
          isActive: !item.isActive,
        });
      }

      if (section === "shifts") {
        await api.patch(`/masters/shifts/${item.id}/status`, {
          isActive: !item.isActive,
        });
      }

      if (section === "vehicleTypes") {
        await api.patch(`/masters/vehicle-types/${item.id}/status`, {
          isActive: !item.isActive,
        });
      }

      setSuccess(
        item.isActive
          ? "Record deactivated successfully"
          : "Record activated successfully"
      );
      await reloadMasters();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update status");
    } finally {
      setStatusUpdatingKey("");
    }
  };

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

  const renderCountBadge = (count) => (
    <span style={styles.countBadge}>{count} records</span>
  );

  const renderActions = (section, item) => (
    <div style={styles.inlineActions}>
      <button
        type="button"
        style={styles.smallButton}
        onClick={() => openEditPanel(section, item)}
        disabled={!canManageMasters || isSaving || isRefreshing || Boolean(statusUpdatingKey)}
      >
        Edit
      </button>
      {section !== "unitMasters" && section !== "materialUnitConversions" ? (
        <button
          type="button"
          style={{
            ...styles.smallButton,
            ...(item.isActive ? styles.warnButton : styles.successButton),
          }}
          onClick={() => handleToggleStatus(section, item)}
          disabled={!canManageMasters || isSaving || isRefreshing || Boolean(statusUpdatingKey)}
        >
          {statusUpdatingKey === `${section}-${item.id}`
            ? "Updating..."
            : item.isActive
              ? "Deactivate"
              : "Activate"}
        </button>
      ) : null}
    </div>
  );

  const renderOptionChoices = (options, useValue = false) =>
    options.map((option) => (
      <option
        key={option.id}
        value={useValue ? option.optionValue || option.optionLabel : option.optionLabel}
      >
        {option.optionLabel}
      </option>
    ));

  const renderSectionEmpty = (title, message) => (
    <div style={styles.emptyStateCard}>
      <strong style={styles.emptyStateTitle}>{title}</strong>
      <p style={styles.emptyStateText}>{message}</p>
    </div>
  );

  const renderEditPanel = () => {
    if (!editState.section || !canManageMasters) return null;

    return (
      <SectionCard title="Edit Record">
        <div style={styles.editHeader}>
          <h3 style={styles.editTitle}>Update selected master</h3>
          <p style={styles.editSubtitle}>
            Edit the record carefully and save changes.
          </p>
        </div>

        <div style={styles.editPanel}>
          {editState.section === "configOptions" && (
            <div style={styles.form}>
              <select
                name="configType"
                value={editState.values.configType || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="plant_type">Plant Type</option>
                <option value="power_source">Power Source</option>
                <option value="material_category">Material Category</option>
                <option value="material_unit">Material Unit</option>
                <option value="vehicle_category">Vehicle Category</option>
                <option value="material_hsn_rule">Material HSN Auto Rule</option>
                <option value="employee_department">Employee Department</option>
                <option value="procurement_item_category">Procurement Item Category</option>
              </select>
              <input
                name="optionLabel"
                placeholder={
                  editState.values.configType === "material_hsn_rule"
                    ? "Match text or keyword, e.g. aggregate"
                    : editState.values.configType === "employee_department"
                      ? "Department name, e.g. Procurement"
                    : editState.values.configType === "procurement_item_category"
                      ? "Category label, e.g. Spare Part"
                    : "Option Label"
                }
                value={editState.values.optionLabel || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                name="optionValue"
                placeholder={
                  editState.values.configType === "material_hsn_rule"
                    ? "HSN / SAC code, e.g. 2517"
                    : editState.values.configType === "employee_department"
                      ? "Default role, e.g. manager"
                    : editState.values.configType === "procurement_item_category"
                      ? "Category key, e.g. spare_part"
                    : "Option Value"
                }
                value={editState.values.optionValue || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                type="number"
                name="sortOrder"
                placeholder="Sort Order"
                value={editState.values.sortOrder ?? ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              {editState.values.configType === "material_hsn_rule" ? (
                <div style={styles.inlineInfoBanner}>
                  `Option Label` is the keyword or phrase to match in the material name/category.
                  `Option Value` is the HSN / SAC code to auto-fill when the rule matches.
                </div>
              ) : null}
              {editState.values.configType === "employee_department" ? (
                <div style={styles.inlineInfoBanner}>
                  `Option Label` is department name. `Option Value` is default login role:
                  `manager`, `hr`, `crusher_supervisor`, `site_engineer`, `operator`, or `admin`.
                </div>
              ) : null}
              {editState.values.configType === "procurement_item_category" ? (
                <div style={styles.inlineInfoBanner}>
                  `Option Label` is the visible item category name in Procurement forms.
                  `Option Value` is the stored category key, e.g. `material`, `spare_part`, `service`.
                </div>
              ) : null}
            </div>
          )}

          {editState.section === "plants" && (
            <div style={styles.form}>
              <input
                name="plantName"
                placeholder="Plant Name"
                value={editState.values.plantName || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                name="plantCode"
                placeholder="Plant Code"
                value={editState.values.plantCode || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <select
                name="plantType"
                value={editState.values.plantType || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">Select Plant Type</option>
                {renderOptionChoices(plantTypes)}
                <option value="__other__">Other</option>
              </select>
              {editState.values.plantType === "__other__" && (
                <input
                  name="plantTypeCustom"
                  placeholder="Enter custom plant type"
                  value={editState.values.plantTypeCustom || ""}
                  onChange={handleEditValueChange}
                  style={styles.input}
                />
              )}
              <input
                name="location"
                placeholder="Location"
                value={editState.values.location || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <select
                name="powerSourceType"
                value={editState.values.powerSourceType || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">Select Power Source</option>
                {renderOptionChoices(powerSources, true)}
                <option value="__other__">Other</option>
              </select>
              {editState.values.powerSourceType === "__other__" && (
                <input
                  name="powerSourceTypeCustom"
                  placeholder="Enter custom power source"
                  value={editState.values.powerSourceTypeCustom || ""}
                  onChange={handleEditValueChange}
                  style={styles.input}
                />
              )}
            </div>
          )}

          {editState.section === "crusherUnits" && (
            <div style={styles.form}>
              <input
                name="unitName"
                placeholder="Unit Name"
                value={editState.values.unitName || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                name="unitCode"
                placeholder="Unit Code"
                value={editState.values.unitCode || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                name="location"
                placeholder="Location"
                value={editState.values.location || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <select
                name="plantType"
                value={editState.values.plantType || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">Select Plant Type</option>
                {renderOptionChoices(plantTypes)}
                <option value="__other__">Other</option>
              </select>
              {editState.values.plantType === "__other__" && (
                <input
                  name="plantTypeCustom"
                  placeholder="Enter custom plant type"
                  value={editState.values.plantTypeCustom || ""}
                  onChange={handleEditValueChange}
                  style={styles.input}
                />
              )}
              <select
                name="powerSourceType"
                value={editState.values.powerSourceType || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">Select Power Source</option>
                {renderOptionChoices(powerSources, true)}
                <option value="__other__">Other</option>
              </select>
              {editState.values.powerSourceType === "__other__" && (
                <input
                  name="powerSourceTypeCustom"
                  placeholder="Enter custom power source"
                  value={editState.values.powerSourceTypeCustom || ""}
                  onChange={handleEditValueChange}
                  style={styles.input}
                />
              )}
            </div>
          )}

          {editState.section === "materials" && (
            <div style={styles.form}>
              <input
                name="materialName"
                placeholder="Material Name"
                value={editState.values.materialName || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                name="materialCode"
                placeholder="Material Code"
                value={editState.values.materialCode || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                name="hsnSacCode"
                placeholder="HSN / SAC Code (blank = auto for known materials)"
                value={editState.values.hsnSacCode || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              {!String(editState.values.hsnSacCode || "").trim() &&
              editSuggestedMaterialHsnSac ? (
                <div style={styles.inlineInfoBanner}>
                  Suggested HSN / SAC: <strong>{editSuggestedMaterialHsnSac.code}</strong> for{" "}
                  {editSuggestedMaterialHsnSac.label}. Leave it blank to auto-fill on save, or
                  enter your own value to override.
                </div>
              ) : null}
              <select
                name="category"
                value={editState.values.category || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">Select Material Category</option>
                {renderOptionChoices(materialCategories)}
                <option value="__other__">Other</option>
              </select>
              {editState.values.category === "__other__" && (
                <input
                  name="categoryCustom"
                  placeholder="Enter custom material category"
                  value={editState.values.categoryCustom || ""}
                  onChange={handleEditValueChange}
                  style={styles.input}
                />
              )}
              <select
                name="unit"
                value={editState.values.unit || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">Select Unit</option>
                {renderOptionChoices(materialUnits, true)}
                <option value="__other__">Other</option>
              </select>
              {editState.values.unit === "__other__" && (
                <input
                  name="unitCustom"
                  placeholder="Enter custom unit"
                  value={editState.values.unitCustom || ""}
                  onChange={handleEditValueChange}
                  style={styles.input}
                />
              )}
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                name="gstRate"
                placeholder="GST Rate (%)"
                value={editState.values.gstRate || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
            </div>
          )}

          {editState.section === "shifts" && (
            <div style={styles.form}>
              <input
                name="shiftName"
                placeholder="Shift Name"
                value={editState.values.shiftName || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                type="time"
                name="startTime"
                value={editState.values.startTime || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                type="time"
                name="endTime"
                value={editState.values.endTime || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
            </div>
          )}

          {editState.section === "vehicleTypes" && (
            <div style={styles.form}>
              <input
                name="typeName"
                placeholder="Type Name"
                value={editState.values.typeName || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <select
                name="category"
                value={editState.values.category || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">Select Vehicle Category</option>
                {renderOptionChoices(vehicleCategories)}
                <option value="__other__">Other</option>
              </select>
              {editState.values.category === "__other__" && (
                <input
                  name="categoryCustom"
                  placeholder="Enter custom vehicle category"
                  value={editState.values.categoryCustom || ""}
                  onChange={handleEditValueChange}
                  style={styles.input}
                />
              )}
            </div>
          )}

          {editState.section === "unitMasters" && (
            <div style={styles.form}>
              <input
                name="unitCode"
                placeholder="Unit Code"
                value={editState.values.unitCode || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                name="unitName"
                placeholder="Unit Name"
                value={editState.values.unitName || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <select
                name="dimensionType"
                value={editState.values.dimensionType || "weight"}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="weight">Weight</option>
                <option value="volume">Volume</option>
                <option value="count">Count</option>
                <option value="distance">Distance</option>
                <option value="time">Time</option>
                <option value="custom">Custom</option>
              </select>
              <input
                type="number"
                min="0"
                max="6"
                name="precisionScale"
                placeholder="Precision Scale"
                value={editState.values.precisionScale || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <select
                name="isBaseUnit"
                value={editState.values.isBaseUnit || "false"}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="false">Derived Unit</option>
                <option value="true">Base Unit</option>
              </select>
              <select
                name="isActive"
                value={editState.values.isActive || "true"}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          )}

          {editState.section === "materialUnitConversions" && (
            <div style={styles.form}>
              <select
                name="materialId"
                value={editState.values.materialId || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">Select Material</option>
                {safeMasters.materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.materialName}
                  </option>
                ))}
              </select>
              <select
                name="fromUnitId"
                value={editState.values.fromUnitId || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">From Unit</option>
                {scopedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitCode} - {unit.unitName}
                  </option>
                ))}
              </select>
              <select
                name="toUnitId"
                value={editState.values.toUnitId || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="">To Unit</option>
                {scopedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitCode} - {unit.unitName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                name="conversionFactor"
                placeholder="Conversion Factor"
                value={editState.values.conversionFactor || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <select
                name="conversionMethod"
                value={editState.values.conversionMethod || "standard"}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="standard">Standard</option>
                <option value="density_based">Density Based</option>
                <option value="vehicle_capacity_based">Vehicle Capacity Based</option>
                <option value="manual_defined">Manual Defined</option>
              </select>
              <input
                type="date"
                name="effectiveFrom"
                value={editState.values.effectiveFrom || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <input
                type="date"
                name="effectiveTo"
                value={editState.values.effectiveTo || ""}
                onChange={handleEditValueChange}
                style={styles.input}
              />
              <select
                name="isActive"
                value={editState.values.isActive || "true"}
                onChange={handleEditValueChange}
                style={styles.input}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <textarea
                name="notes"
                placeholder="Notes"
                value={editState.values.notes || ""}
                onChange={handleEditValueChange}
                style={styles.textarea}
              />
            </div>
          )}

          <div style={styles.actionRow}>
            <button
              type="button"
              style={styles.button}
              onClick={handleSaveEdit}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={closeEditPanel}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      </SectionCard>
    );
  };

  const renderWorkspaceHeader = ({
    title,
    subtitle,
    count,
    listKey,
    formOpen,
    onToggleForm,
    formButtonLabel,
  }) => (
    <div style={styles.workspaceHeader}>
      <div style={styles.workspaceTitleWrap}>
        <div style={styles.workspaceTitleRow}>
          <h3 style={styles.blockTitle}>{title}</h3>
          {renderCountBadge(count)}
        </div>
        <p style={styles.blockSubtitle}>{subtitle}</p>
      </div>

      <div style={styles.workspaceActions}>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => toggleListVisibility(listKey)}
          disabled={isSaving || isRefreshing}
        >
          {listVisibility[listKey] ? "Hide List" : "Show List"}
        </button>
        <button
          type="button"
          style={formOpen ? styles.secondaryButton : styles.button}
          onClick={onToggleForm}
          disabled={!canManageMasters || isSaving || isRefreshing}
        >
          {formOpen ? "Hide Form" : formButtonLabel}
        </button>
      </div>
    </div>
  );

  return (
    <AppShell
      title="Masters"
      subtitle="Core setup for plants, materials, shifts, and vehicle types"
    >
      <div style={styles.pageStack}>
        <div style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.heroContent}>
            <div>
              <p style={styles.heroEyebrow}>ERP Configuration Layer</p>
              <h1 style={styles.heroTitle}>Masters Control Center</h1>
              <p style={styles.heroText}>
                Configure core masters with a fast, reliable workspace.
              </p>
            </div>

            <div style={styles.heroPills}>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Layout</span>
                <strong style={styles.heroPillValue}>Unified master workspace</strong>
              </div>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>UX</span>
                <strong style={styles.heroPillValue}>Collapsible record sections</strong>
              </div>
            </div>
          </div>
        </div>

        {(mastersError || error) && (
          <div style={styles.messageError}>{mastersError || error}</div>
        )}
        {success && <div style={styles.messageSuccess}>{success}</div>}
        {isRefreshing && (
          <div style={styles.loadingBanner}>
            Refreshing master data, configuration options, and plants...
          </div>
        )}

        <SectionCard title="Workspace Health">
          {!canManageMasters && (
            <div style={styles.readOnlyBanner}>
              This role has read-only access to masters. You can review diagnostics and records, but create, edit, activation, and auto-fill actions are restricted.
            </div>
          )}

          <div style={styles.syncBanner}>
            <div>
              <p style={styles.syncLabel}>Master Data Sync</p>
              <strong style={styles.syncValue}>
                {refreshingMasters || isRefreshing
                  ? "Refreshing scoped master references..."
                  : `Last sync: ${mastersSyncLabel}`}
              </strong>
            </div>
            <span style={styles.syncNote}>
              These references now drive scoped dropdowns, billing logic, and operational forms across the admin.
            </span>
          </div>

          <div style={styles.workspaceControlBar}>
            <div style={styles.workspaceControlCopy}>
              <span style={styles.workspaceControlLabel}>Compliance & Reliability</span>
              <strong style={styles.workspaceControlValue}>
                {loadingHealthCheck
                  ? "Running diagnostics..."
                  : `${mastersHealth?.issues?.length || 0} actionable issue${(mastersHealth?.issues?.length || 0) === 1 ? "" : "s"} found`}
              </strong>
              <span style={styles.workspaceControlMeta}>
                Missing HSN/SAC: {formatMetric(mastersHealth?.counts?.materialsMissingHsnSac || 0)} | Active HSN rules: {formatMetric(mastersHealth?.counts?.activeMaterialHsnRules || 0)}
              </span>
              <span style={styles.workspaceControlMeta}>
                Invalid GST rates: {formatMetric(mastersHealth?.counts?.materialsInvalidGstRate || 0)} | Plant types: {formatMetric(mastersHealth?.counts?.activePlantTypes || 0)} | Power sources: {formatMetric(mastersHealth?.counts?.activePowerSources || 0)}
              </span>
            </div>

            <div style={styles.workspaceControlActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={loadMastersHealthCheck}
                disabled={isSaving || isRefreshing || loadingHealthCheck || isRunningAutoHsn}
              >
                {loadingHealthCheck ? "Checking..." : "Run Diagnostics"}
              </button>
              <button
                type="button"
                style={styles.button}
                onClick={runAutoFillMaterialHsnSac}
                disabled={
                  !canManageMasters ||
                  isSaving ||
                  isRefreshing ||
                  loadingHealthCheck ||
                  isRunningAutoHsn ||
                  Number(mastersHealth?.counts?.materialsMissingHsnSac || 0) === 0
                }
              >
                {isRunningAutoHsn ? "Auto-filling..." : "Auto-fill Missing HSN/SAC"}
              </button>
            </div>
          </div>

          {mastersHealth?.issues?.length ? (
            <div style={styles.inlineListCard}>
              <p style={styles.inlineListTitle}>Diagnostic Findings</p>
              <div style={styles.inlineList}>
                {mastersHealth.issues.map((issue) => (
                  <div key={issue.code} style={styles.inlineListItem}>
                    <div style={styles.inlineListItemHeader}>
                      <strong style={styles.inlineListItemTitle}>
                        {issue.title}
                        {typeof issue.count === "number" ? ` (${issue.count})` : ""}
                      </strong>
                      <span
                        style={{
                          ...styles.severityBadge,
                          ...getSeverityStyle(issue.severity),
                        }}
                      >
                        {String(issue.severity || "info").toUpperCase()}
                      </span>
                    </div>
                    <span style={styles.inlineListItemMeta}>{issue.description}</span>
                    {Array.isArray(issue.samples) && issue.samples.length > 0 ? (
                      <div style={styles.sampleChips}>
                        {issue.samples.map((sample, index) => (
                          <span key={`${issue.code}-${sample}-${index}`} style={styles.sampleChip}>
                            {sample}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={styles.inlineInfoBanner}>
              No active master-data diagnostics found. This workspace looks healthy for dispatch and billing operations.
            </div>
          )}

          <div style={styles.healthGrid}>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Visible Sections</span>
              <strong style={styles.healthValue}>
                {formatMetric(filteredSummary.sectionsVisible)}
              </strong>
              <p style={styles.healthNote}>
                Master areas currently returning results in this view
              </p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Visible Records</span>
              <strong style={styles.healthValue}>
                {formatMetric(filteredSummary.totalVisibleRecords)}
              </strong>
              <p style={styles.healthNote}>
                Combined records after applying search, section, and status filters
              </p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Active Plants</span>
              <strong style={styles.healthValue}>
                {formatMetric(filteredSummary.activePlantCount)}
              </strong>
              <p style={styles.healthNote}>
                Operational locations available to reports, vehicles, and dispatch
              </p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Active Materials</span>
              <strong style={styles.healthValue}>
                {formatMetric(filteredSummary.activeMaterialCount)}
              </strong>
              <p style={styles.healthNote}>
                Billing-ready materials available for rate and GST workflows
              </p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Active Config Options</span>
              <strong style={styles.healthValue}>
                {formatMetric(filteredSummary.activeConfigCount)}
              </strong>
              <p style={styles.healthNote}>
                Shared option values available across master-driven forms
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Overview">
          {loadingMasters ? (
            <p style={styles.muted}>Loading master data...</p>
          ) : (
            <div style={styles.summaryGrid}>
              <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
                <span style={styles.summaryTag}>Core</span>
                <p style={styles.summaryLabel}>Plants & Units</p>
                <h3 style={styles.summaryValue}>{summary.plants}</h3>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
                <span style={styles.summaryTag}>Operations</span>
                <p style={styles.summaryLabel}>Sub Plants & Units</p>
                <h3 style={styles.summaryValue}>{summary.crusherUnits}</h3>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
                <span style={styles.summaryTag}>Materials</span>
                <p style={styles.summaryLabel}>Materials</p>
                <h3 style={styles.summaryValue}>{summary.materials}</h3>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
                <span style={styles.summaryTag}>Units</span>
                <p style={styles.summaryLabel}>Unit Master</p>
                <h3 style={styles.summaryValue}>{summary.unitMasters}</h3>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
                <span style={styles.summaryTag}>Conversions</span>
                <p style={styles.summaryLabel}>Material Unit Conversions</p>
                <h3 style={styles.summaryValue}>{summary.materialUnitConversions}</h3>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.summaryPurple }}>
                <span style={styles.summaryTag}>Planning</span>
                <p style={styles.summaryLabel}>Shifts</p>
                <h3 style={styles.summaryValue}>{summary.shifts}</h3>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.summaryCyan }}>
                <span style={styles.summaryTag}>Fleet</span>
                <p style={styles.summaryLabel}>Vehicle Types</p>
                <h3 style={styles.summaryValue}>{summary.vehicleTypes}</h3>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.summarySlate }}>
                <span style={styles.summaryTag}>Config</span>
                <p style={styles.summaryLabel}>Option Values</p>
                <h3 style={styles.summaryValue}>{summary.configOptions}</h3>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Workspace Controls">
          <div style={styles.workspaceControlBar}>
            <div style={styles.workspaceControlCopy}>
              <span style={styles.workspaceControlLabel}>Current View</span>
              <strong style={styles.workspaceControlValue}>
                {sectionFilterLabels[sectionFilter] || "All master sections"}
              </strong>
              <span style={styles.workspaceControlMeta}>
                Search: {globalSearch.trim() || "none"} | Status: {statusFilter}
              </span>
            </div>

            <div style={styles.workspaceControlActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={expandAllLists}
                disabled={isSaving || isRefreshing}
              >
                Show All Lists
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={collapseAllLists}
                disabled={isSaving || isRefreshing}
              >
                Hide All Lists
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={resetWorkspaceView}
                disabled={isSaving || isRefreshing}
              >
                Reset View
              </button>
              <button
                type="button"
                style={styles.button}
                onClick={refreshWorkspace}
                disabled={isSaving || isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh Workspace"}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Global Search & Filter">
          <p style={styles.sectionSubtitle}>
            Search across all master sections from one place and narrow the workspace by section or status.
          </p>

          <div style={styles.form}>
            <input
              placeholder="Search all masters by name, code, category, location, type, unit, or value"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              style={styles.input}
            />

            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              style={styles.input}
            >
              <option value="all">All Sections</option>
              <option value="plants">Plants & Units</option>
              <option value="crusherUnits">Sub Plants & Units</option>
              <option value="materials">Materials</option>
              <option value="unitMasters">Unit Master</option>
              <option value="materialUnitConversions">Material Unit Conversions</option>
              <option value="shifts">Shifts</option>
              <option value="vehicleTypes">Vehicle Types</option>
              <option value="configOptions">Config Options</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.input}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <div style={styles.filterMetaRow}>
            <span style={styles.filterMetaText}>
              Showing {formatMetric(filteredSummary.totalVisibleRecords)} records across {formatMetric(filteredSummary.sectionsVisible)} sections
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={resetWorkspaceView}
                disabled={isSaving || isRefreshing}
              >
                Clear Filters
              </button>
            )}
          </div>
        </SectionCard>

        {renderEditPanel()}

        {shouldShowSection("configOptions") && (
          <SectionCard title="Configuration Options">
            {renderWorkspaceHeader({
              title: "Reusable ERP Options",
              subtitle:
                "Manage plant types, power sources, material categories, units, vehicle categories, and editable material HSN auto-rules from one place.",
              count: filteredConfigOptions.length,
              listKey: "configOptions",
              formOpen: openPanels.config,
              onToggleForm: () => togglePanel("config"),
              formButtonLabel: "Add Config Option",
            })}

            {listVisibility.configOptions && (
              <>
                {filteredConfigOptions.length === 0 ? (
                  renderSectionEmpty(
                    "No configuration options match this view",
                    "Try broadening your global search or switching back to all statuses to reveal reusable ERP option values."
                  )
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Label</th>
                          <th style={styles.th}>Value</th>
                          <th style={styles.th}>Order</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredConfigOptions.map((option) => (
                          <tr key={option.id}>
                            <td style={styles.td}>{option.configType}</td>
                            <td style={styles.td}>{option.optionLabel}</td>
                            <td style={styles.td}>{option.optionValue || "-"}</td>
                            <td style={styles.td}>{option.sortOrder}</td>
                            <td style={styles.td}>{renderStatusBadge(option.isActive)}</td>
                            <td style={styles.td}>{renderActions("configOptions", option)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {openPanels.config && canManageMasters && (
              <div style={styles.compactFormShell}>
                <h3 style={styles.blockTitle}>Add Config Option</h3>
                <form
                  style={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();

                    if (!configForm.configType || !configForm.optionLabel) {
                      setError("Config type and option label are required");
                      setSuccess("");
                      return;
                    }

                    handleCreate({
                      url: "/masters/config-options",
                      payload: {
                        ...configForm,
                        optionValue: configForm.optionValue || configForm.optionLabel,
                        sortOrder:
                          configForm.sortOrder === "" ? 0 : Number(configForm.sortOrder),
                      },
                      successMessage: "Configuration option added successfully",
                      reset: () =>
                        setConfigForm({
                          configType: "plant_type",
                          optionLabel: "",
                          optionValue: "",
                          sortOrder: "",
                        }),
                    });
                  }}
                >
                  <select
                    name="configType"
                    value={configForm.configType}
                    onChange={handleChange(setConfigForm)}
                    style={styles.input}
                  >
                    <option value="plant_type">Plant Type</option>
                    <option value="power_source">Power Source</option>
                    <option value="material_category">Material Category</option>
                    <option value="material_unit">Material Unit</option>
                    <option value="vehicle_category">Vehicle Category</option>
                    <option value="material_hsn_rule">Material HSN Auto Rule</option>
                    <option value="employee_department">Employee Department</option>
                  </select>

                  <input
                    name="optionLabel"
                    placeholder={
                      configForm.configType === "employee_department"
                        ? "Department name, e.g. Procurement"
                        : "Option Label"
                    }
                    value={configForm.optionLabel}
                    onChange={handleChange(setConfigForm)}
                    style={styles.input}
                  />

                  <input
                    name="optionValue"
                    placeholder={
                      configForm.configType === "employee_department"
                        ? "Default role, e.g. manager"
                        : "Option Value (optional)"
                    }
                    value={configForm.optionValue}
                    onChange={handleChange(setConfigForm)}
                    style={styles.input}
                  />

                  <input
                    type="number"
                    name="sortOrder"
                    placeholder="Sort Order"
                    value={configForm.sortOrder}
                    onChange={handleChange(setConfigForm)}
                    style={styles.input}
                  />

                  <button type="submit" style={styles.button} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Option"}
                  </button>
                </form>
              </div>
            )}
          </SectionCard>
        )}

        {shouldShowSection("plants") && (
          <SectionCard title="Plants & Units">
            {renderWorkspaceHeader({
              title: "Plants & Units Workspace",
              subtitle:
                "Multi-plant business locations used across vehicles, dispatch, reports, and operations.",
              count: filteredPlants.length,
              listKey: "plants",
              formOpen: openPanels.plant,
              onToggleForm: () => togglePanel("plant"),
              formButtonLabel: "Add Plant / Unit",
            })}

            {listVisibility.plants && (
              <>
                {filteredPlants.length === 0 ? (
                  renderSectionEmpty(
                    "No plants or units match this view",
                    "Adjust the current search or status filter to surface location records, or add a new plant to start operational setup."
                  )
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Plant Name</th>
                          <th style={styles.th}>Code</th>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Location</th>
                          <th style={styles.th}>Power</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPlants.map((plant) => (
                          <tr key={plant.id}>
                            <td style={styles.td}>{plant.plantName}</td>
                            <td style={styles.td}>{plant.plantCode || "-"}</td>
                            <td style={styles.td}>{plant.plantType}</td>
                            <td style={styles.td}>{plant.location || "-"}</td>
                            <td style={styles.td}>{plant.powerSourceType || "-"}</td>
                            <td style={styles.td}>{renderStatusBadge(plant.isActive)}</td>
                            <td style={styles.td}>{renderActions("plants", plant)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {openPanels.plant && canManageMasters && (
              <div style={styles.compactFormShell}>
                <h3 style={styles.blockTitle}>Add Plant / Unit</h3>
                <p style={styles.blockSubtitle}>
                  Add only real operational business units here.
                </p>

                <form
                  style={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();

                    const finalPlantType = resolveOtherValue(
                      plantForm.plantType,
                      plantForm.plantTypeCustom
                    );
                    const finalPowerSourceType = resolveOtherValue(
                      plantForm.powerSourceType,
                      plantForm.powerSourceTypeCustom
                    );

                    if (!plantForm.plantName || !finalPlantType) {
                      setError("Plant / unit name and type are required");
                      setSuccess("");
                      return;
                    }

                    handleCreate({
                      url: "/plants",
                      payload: {
                        plantName: plantForm.plantName,
                        plantCode: plantForm.plantCode,
                        plantType: finalPlantType,
                        location: plantForm.location,
                        powerSourceType: finalPowerSourceType,
                      },
                      successMessage: "Plant / unit added successfully",
                      reset: () =>
                        setPlantForm({
                          plantName: "",
                          plantCode: "",
                          plantType: "",
                          plantTypeCustom: "",
                          location: "",
                          powerSourceType: "",
                          powerSourceTypeCustom: "",
                        }),
                      afterSuccess: loadPlants,
                    });
                  }}
                >
                  <input
                    name="plantName"
                    placeholder="Plant / Unit Name"
                    value={plantForm.plantName}
                    onChange={handleChange(setPlantForm)}
                    style={styles.input}
                  />
                  <input
                    name="plantCode"
                    placeholder="Plant Code"
                    value={plantForm.plantCode}
                    onChange={handleChange(setPlantForm)}
                    style={styles.input}
                  />
                  <select
                    name="plantType"
                    value={plantForm.plantType}
                    onChange={handleChange(setPlantForm)}
                    style={styles.input}
                  >
                    <option value="">Select Plant Type</option>
                    {renderOptionChoices(plantTypes)}
                    <option value="__other__">Other</option>
                  </select>
                  {plantForm.plantType === "__other__" && (
                    <input
                      name="plantTypeCustom"
                      placeholder="Enter custom plant type"
                      value={plantForm.plantTypeCustom}
                      onChange={handleChange(setPlantForm)}
                      style={styles.input}
                    />
                  )}
                  <input
                    name="location"
                    placeholder="Location"
                    value={plantForm.location}
                    onChange={handleChange(setPlantForm)}
                    style={styles.input}
                  />
                  <select
                    name="powerSourceType"
                    value={plantForm.powerSourceType}
                    onChange={handleChange(setPlantForm)}
                    style={styles.input}
                  >
                    <option value="">Select Power Source</option>
                    {renderOptionChoices(powerSources, true)}
                    <option value="__other__">Other</option>
                  </select>
                  {plantForm.powerSourceType === "__other__" && (
                    <input
                      name="powerSourceTypeCustom"
                      placeholder="Enter custom power source"
                      value={plantForm.powerSourceTypeCustom}
                      onChange={handleChange(setPlantForm)}
                      style={styles.input}
                    />
                  )}
                  <button type="submit" style={styles.button} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Add Plant / Unit"}
                  </button>
                </form>
              </div>
            )}
          </SectionCard>
        )}

        {shouldShowSection("crusherUnits") && (
          <SectionCard title="Sub Plants & Units">
            {renderWorkspaceHeader({
              title: "Sub Plants & Units Workspace",
              subtitle:
                "Operational sub-units inside your plant network for dispatch, reporting, and shift mapping.",
              count: filteredCrusherUnits.length,
              listKey: "crusherUnits",
              formOpen: openPanels.crusherUnit,
              onToggleForm: () => togglePanel("crusherUnit"),
              formButtonLabel: "Add Sub Plant / Unit",
            })}

            {listVisibility.crusherUnits && (
              <>
                {filteredCrusherUnits.length === 0 ? (
                  renderSectionEmpty(
                    "No sub plants or units match this view",
                    "Operational sub units will appear here once they are created or when your current filters are broadened."
                  )
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Unit Name</th>
                          <th style={styles.th}>Code</th>
                          <th style={styles.th}>Plant Type</th>
                          <th style={styles.th}>Location</th>
                          <th style={styles.th}>Power Source</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCrusherUnits.map((unit) => (
                          <tr key={unit.id}>
                            <td style={styles.td}>{unit.unitName}</td>
                            <td style={styles.td}>{unit.unitCode || "-"}</td>
                            <td style={styles.td}>{unit.plantType || "-"}</td>
                            <td style={styles.td}>{unit.location || "-"}</td>
                            <td style={styles.td}>{unit.powerSourceType || "-"}</td>
                            <td style={styles.td}>{renderStatusBadge(unit.isActive)}</td>
                            <td style={styles.td}>{renderActions("crusherUnits", unit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {openPanels.crusherUnit && canManageMasters && (
              <div style={styles.compactFormShell}>
                <h3 style={styles.blockTitle}>Add Sub Plant / Unit</h3>

                <form
                  style={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();

                    const finalPlantType = resolveOtherValue(
                      crusherUnitForm.plantType,
                      crusherUnitForm.plantTypeCustom
                    );
                    const finalPowerSourceType = resolveOtherValue(
                      crusherUnitForm.powerSourceType,
                      crusherUnitForm.powerSourceTypeCustom
                    );

                    handleCreate({
                      url: "/masters/crusher-units",
                      payload: {
                        unitName: crusherUnitForm.unitName,
                        unitCode: crusherUnitForm.unitCode,
                        location: crusherUnitForm.location,
                        plantType: finalPlantType,
                        powerSourceType: finalPowerSourceType,
                      },
                      successMessage: "Sub plant / unit added successfully",
                      reset: () =>
                        setCrusherUnitForm({
                          unitName: "",
                          unitCode: "",
                          location: "",
                          plantType: "",
                          plantTypeCustom: "",
                          powerSourceType: "",
                          powerSourceTypeCustom: "",
                        }),
                    });
                  }}
                >
                  <input
                    name="unitName"
                    placeholder="Unit Name"
                    value={crusherUnitForm.unitName}
                    onChange={handleChange(setCrusherUnitForm)}
                    style={styles.input}
                  />
                  <input
                    name="unitCode"
                    placeholder="Unit Code"
                    value={crusherUnitForm.unitCode}
                    onChange={handleChange(setCrusherUnitForm)}
                    style={styles.input}
                  />
                  <input
                    name="location"
                    placeholder="Location"
                    value={crusherUnitForm.location}
                    onChange={handleChange(setCrusherUnitForm)}
                    style={styles.input}
                  />
                  <select
                    name="plantType"
                    value={crusherUnitForm.plantType}
                    onChange={handleChange(setCrusherUnitForm)}
                    style={styles.input}
                  >
                    <option value="">Select Plant Type</option>
                    {renderOptionChoices(plantTypes)}
                    <option value="__other__">Other</option>
                  </select>
                  {crusherUnitForm.plantType === "__other__" && (
                    <input
                      name="plantTypeCustom"
                      placeholder="Enter custom plant type"
                      value={crusherUnitForm.plantTypeCustom}
                      onChange={handleChange(setCrusherUnitForm)}
                      style={styles.input}
                    />
                  )}
                  <select
                    name="powerSourceType"
                    value={crusherUnitForm.powerSourceType}
                    onChange={handleChange(setCrusherUnitForm)}
                    style={styles.input}
                  >
                    <option value="">Select Power Source</option>
                    {renderOptionChoices(powerSources, true)}
                    <option value="__other__">Other</option>
                  </select>
                  {crusherUnitForm.powerSourceType === "__other__" && (
                    <input
                      name="powerSourceTypeCustom"
                      placeholder="Enter custom power source"
                      value={crusherUnitForm.powerSourceTypeCustom}
                      onChange={handleChange(setCrusherUnitForm)}
                      style={styles.input}
                    />
                  )}
                  <button type="submit" style={styles.button} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Sub Plant / Unit"}
                  </button>
                </form>
              </div>
            )}
          </SectionCard>
        )}

        {shouldShowSection("materials") && (
          <SectionCard title="Materials">
            {renderWorkspaceHeader({
              title: "Material Workspace",
              subtitle:
                "Controlled material setup for dispatch, GST billing, and reporting.",
              count: filteredMaterials.length,
              listKey: "materials",
              formOpen: openPanels.material,
              onToggleForm: () => togglePanel("material"),
              formButtonLabel: "Add Material",
            })}

            {materialsMissingHsnSac > 0 && (
              <div style={styles.inlineAlertWarn}>
                {materialsMissingHsnSac} active material
                {materialsMissingHsnSac === 1 ? "" : "s"} still {materialsMissingHsnSac === 1 ? "has" : "have"} no HSN / SAC code.
                Update these before using the material on tax-facing invoice prints.
              </div>
            )}

            {listVisibility.materials && (
              <>
                {filteredMaterials.length === 0 ? (
                  renderSectionEmpty(
                    "No materials match this view",
                    "Materials power billing and dispatch logic, so keeping this section populated helps the rest of the ERP stay reliable."
                  )
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Material Name</th>
                          <th style={styles.th}>Code</th>
                          <th style={styles.th}>HSN / SAC</th>
                          <th style={styles.th}>Category</th>
                          <th style={styles.th}>Unit</th>
                          <th style={styles.th}>GST Rate</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMaterials.map((material) => (
                          <tr key={material.id}>
                            <td style={styles.td}>{material.materialName}</td>
                            <td style={styles.td}>{material.materialCode || "-"}</td>
                            <td style={styles.td}>{material.hsnSacCode || "-"}</td>
                            <td style={styles.td}>{material.category || "-"}</td>
                            <td style={styles.td}>{material.unit || "-"}</td>
                            <td style={styles.td}>
                              {material.gstRate !== null && material.gstRate !== undefined
                                ? `${material.gstRate}%`
                                : "-"}
                            </td>
                            <td style={styles.td}>{renderStatusBadge(material.isActive)}</td>
                            <td style={styles.td}>{renderActions("materials", material)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {openPanels.material && canManageMasters && (
              <div style={styles.compactFormShell}>
                <h3 style={styles.blockTitle}>Add Material</h3>
                <p style={styles.blockSubtitle}>
                  Material pricing comes from parties, but GST configuration belongs here on the material master.
                  HSN / SAC should also be maintained here so printed dispatch invoices stay tax-complete.
                </p>

                <form
                  style={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();

                    const finalCategory = resolveOtherValue(
                      materialForm.category,
                      materialForm.categoryCustom
                    );
                    const finalUnit = resolveOtherValue(
                      materialForm.unit,
                      materialForm.unitCustom
                    );

                    handleCreate({
                      url: "/masters/materials",
                      payload: {
                        materialName: materialForm.materialName,
                        materialCode: materialForm.materialCode,
                        hsnSacCode: materialForm.hsnSacCode,
                        category: finalCategory,
                        unit: finalUnit,
                        gstRate: Number(materialForm.gstRate || 0),
                      },
                      successMessage: "Material added successfully",
                      reset: () =>
                        setMaterialForm({
                          materialName: "",
                          materialCode: "",
                          hsnSacCode: "",
                          category: "",
                          categoryCustom: "",
                          unit: "",
                          unitCustom: "",
                          gstRate: "5",
                        }),
                    });
                  }}
                >
                  <input
                    name="materialName"
                    placeholder="Material Name"
                    value={materialForm.materialName}
                    onChange={handleChange(setMaterialForm)}
                    style={styles.input}
                  />
                  <input
                    name="materialCode"
                    placeholder="Material Code"
                    value={materialForm.materialCode}
                    onChange={handleChange(setMaterialForm)}
                    style={styles.input}
                  />
                  <input
                    name="hsnSacCode"
                    placeholder="HSN / SAC Code (blank = auto for known materials)"
                    value={materialForm.hsnSacCode}
                    onChange={handleChange(setMaterialForm)}
                    style={styles.input}
                  />
                  {!String(materialForm.hsnSacCode || "").trim() &&
                  materialFormSuggestedHsnSac ? (
                    <div style={styles.inlineInfoBanner}>
                      Suggested HSN / SAC: <strong>{materialFormSuggestedHsnSac.code}</strong> for{" "}
                      {materialFormSuggestedHsnSac.label}. Leave it blank to auto-fill on save, or
                      enter your own value to override.
                    </div>
                  ) : null}
                  <select
                    name="category"
                    value={materialForm.category}
                    onChange={handleChange(setMaterialForm)}
                    style={styles.input}
                  >
                    <option value="">Select Material Category</option>
                    {renderOptionChoices(materialCategories)}
                    <option value="__other__">Other</option>
                  </select>
                  {materialForm.category === "__other__" && (
                    <input
                      name="categoryCustom"
                      placeholder="Enter custom material category"
                      value={materialForm.categoryCustom}
                      onChange={handleChange(setMaterialForm)}
                      style={styles.input}
                    />
                  )}
                  <select
                    name="unit"
                    value={materialForm.unit}
                    onChange={handleChange(setMaterialForm)}
                    style={styles.input}
                  >
                    <option value="">Select Unit</option>
                    {renderOptionChoices(materialUnits, true)}
                    <option value="__other__">Other</option>
                  </select>
                  {materialForm.unit === "__other__" && (
                    <input
                      name="unitCustom"
                      placeholder="Enter custom unit"
                      value={materialForm.unitCustom}
                      onChange={handleChange(setMaterialForm)}
                      style={styles.input}
                    />
                  )}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    name="gstRate"
                    placeholder="GST Rate (%)"
                    value={materialForm.gstRate}
                    onChange={handleChange(setMaterialForm)}
                    style={styles.input}
                  />
                  <button type="submit" style={styles.button} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Material"}
                  </button>
                </form>
              </div>
            )}
          </SectionCard>
        )}

        {shouldShowSection("unitMasters") && (
          <SectionCard title="Unit Master">
            {renderWorkspaceHeader({
              title: "Unit Master Workspace",
              subtitle:
                "Maintain reusable quantity units for materials, dispatch conversions, and future pricing flows.",
              count: filteredUnits.length,
              listKey: "unitMasters",
              formOpen: openPanels.unitMaster,
              onToggleForm: () => togglePanel("unitMaster"),
              formButtonLabel: "Add Unit",
            })}

            {listVisibility.unitMasters && (
              <>
                {filteredUnits.length === 0 ? (
                  renderSectionEmpty(
                    "No units match this view",
                    "Add quantity units here so material conversions and future commercial workflows can use shared master references."
                  )
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Code</th>
                          <th style={styles.th}>Name</th>
                          <th style={styles.th}>Dimension</th>
                          <th style={styles.th}>Precision</th>
                          <th style={styles.th}>Base</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUnits.map((unit) => (
                          <tr key={unit.id}>
                            <td style={styles.td}>{unit.unitCode}</td>
                            <td style={styles.td}>{unit.unitName}</td>
                            <td style={styles.td}>{unit.dimensionType}</td>
                            <td style={styles.td}>{unit.precisionScale}</td>
                            <td style={styles.td}>{unit.isBaseUnit ? "Yes" : "No"}</td>
                            <td style={styles.td}>{renderStatusBadge(unit.isActive)}</td>
                            <td style={styles.td}>{renderActions("unitMasters", unit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {openPanels.unitMaster && canManageMasters && (
              <div style={styles.compactFormShell}>
                <h3 style={styles.blockTitle}>Add Unit</h3>
                <p style={styles.blockSubtitle}>
                  Unit codes should stay short and consistent so commercial and operational forms can reuse them cleanly.
                </p>

                <form
                  style={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();

                    if (!unitForm.unitCode || !unitForm.unitName) {
                      setError("Unit code and unit name are required");
                      setSuccess("");
                      return;
                    }

                    handleCreate({
                      url: "/masters/units",
                      payload: {
                        unitCode: unitForm.unitCode,
                        unitName: unitForm.unitName,
                        dimensionType: unitForm.dimensionType,
                        precisionScale: Number(unitForm.precisionScale || 0),
                        isBaseUnit: unitForm.isBaseUnit === "true",
                        isActive: unitForm.isActive === "true",
                      },
                      successMessage: "Unit added successfully",
                      reset: () =>
                        setUnitForm({
                          unitCode: "",
                          unitName: "",
                          dimensionType: "weight",
                          precisionScale: "3",
                          isBaseUnit: "false",
                          isActive: "true",
                        }),
                      afterSuccess: loadUnits,
                    });
                  }}
                >
                  <input
                    name="unitCode"
                    placeholder="Unit Code"
                    value={unitForm.unitCode}
                    onChange={handleChange(setUnitForm)}
                    style={styles.input}
                  />
                  <input
                    name="unitName"
                    placeholder="Unit Name"
                    value={unitForm.unitName}
                    onChange={handleChange(setUnitForm)}
                    style={styles.input}
                  />
                  <select
                    name="dimensionType"
                    value={unitForm.dimensionType}
                    onChange={handleChange(setUnitForm)}
                    style={styles.input}
                  >
                    <option value="weight">Weight</option>
                    <option value="volume">Volume</option>
                    <option value="count">Count</option>
                    <option value="distance">Distance</option>
                    <option value="time">Time</option>
                    <option value="custom">Custom</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    name="precisionScale"
                    placeholder="Precision Scale"
                    value={unitForm.precisionScale}
                    onChange={handleChange(setUnitForm)}
                    style={styles.input}
                  />
                  <select
                    name="isBaseUnit"
                    value={unitForm.isBaseUnit}
                    onChange={handleChange(setUnitForm)}
                    style={styles.input}
                  >
                    <option value="false">Derived Unit</option>
                    <option value="true">Base Unit</option>
                  </select>
                  <select
                    name="isActive"
                    value={unitForm.isActive}
                    onChange={handleChange(setUnitForm)}
                    style={styles.input}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <button type="submit" style={styles.button} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Unit"}
                  </button>
                </form>
              </div>
            )}
          </SectionCard>
        )}

        {shouldShowSection("materialUnitConversions") && (
          <SectionCard title="Material Unit Conversions">
            {renderWorkspaceHeader({
              title: "Material Conversion Workspace",
              subtitle:
                "Define material-specific quantity conversion factors that later dispatch and commercial flows can reuse safely.",
              count: filteredMaterialUnitConversions.length,
              listKey: "materialUnitConversions",
              formOpen: openPanels.materialUnitConversion,
              onToggleForm: () => togglePanel("materialUnitConversion"),
              formButtonLabel: "Add Conversion",
            })}

            {listVisibility.materialUnitConversions && (
              <>
                {filteredMaterialUnitConversions.length === 0 ? (
                  renderSectionEmpty(
                    "No material unit conversions match this view",
                    "Add material-wise conversion factors here before using unit-flexible dispatch and commercial workflows."
                  )
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Material</th>
                          <th style={styles.th}>From</th>
                          <th style={styles.th}>To</th>
                          <th style={styles.th}>Factor</th>
                          <th style={styles.th}>Method</th>
                          <th style={styles.th}>Effective From</th>
                          <th style={styles.th}>Effective To</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMaterialUnitConversions.map((conversion) => (
                          <tr key={conversion.id}>
                            <td style={styles.td}>
                              {conversion.materialName ||
                                materialsById.get(String(conversion.materialId))?.materialName ||
                                "-"}
                            </td>
                            <td style={styles.td}>
                              {conversion.fromUnitCode ||
                                unitsById.get(String(conversion.fromUnitId))?.unitCode ||
                                "-"}
                            </td>
                            <td style={styles.td}>
                              {conversion.toUnitCode ||
                                unitsById.get(String(conversion.toUnitId))?.unitCode ||
                                "-"}
                            </td>
                            <td style={styles.td}>{conversion.conversionFactor}</td>
                            <td style={styles.td}>{conversion.conversionMethod}</td>
                            <td style={styles.td}>{conversion.effectiveFrom}</td>
                            <td style={styles.td}>{conversion.effectiveTo || "-"}</td>
                            <td style={styles.td}>{renderStatusBadge(conversion.isActive)}</td>
                            <td style={styles.td}>
                              {renderActions("materialUnitConversions", conversion)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {openPanels.materialUnitConversion && canManageMasters && (
              <div style={styles.compactFormShell}>
                <h3 style={styles.blockTitle}>Add Material Unit Conversion</h3>
                <p style={styles.blockSubtitle}>
                  Each record should represent one direction and one effective date range for a specific material and unit pair.
                </p>

                <form
                  style={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();

                    if (
                      !materialUnitConversionForm.materialId ||
                      !materialUnitConversionForm.fromUnitId ||
                      !materialUnitConversionForm.toUnitId ||
                      !materialUnitConversionForm.conversionFactor ||
                      !materialUnitConversionForm.effectiveFrom
                    ) {
                      setError(
                        "Material, from unit, to unit, conversion factor, and effective from date are required"
                      );
                      setSuccess("");
                      return;
                    }

                    handleCreate({
                      url: "/masters/material-unit-conversions",
                      payload: {
                        materialId: Number(materialUnitConversionForm.materialId),
                        fromUnitId: Number(materialUnitConversionForm.fromUnitId),
                        toUnitId: Number(materialUnitConversionForm.toUnitId),
                        conversionFactor: Number(materialUnitConversionForm.conversionFactor),
                        conversionMethod: materialUnitConversionForm.conversionMethod,
                        effectiveFrom: materialUnitConversionForm.effectiveFrom,
                        effectiveTo: materialUnitConversionForm.effectiveTo || null,
                        notes: materialUnitConversionForm.notes,
                        isActive: materialUnitConversionForm.isActive === "true",
                      },
                      successMessage: "Material unit conversion added successfully",
                      reset: () =>
                        setMaterialUnitConversionForm({
                          materialId: "",
                          fromUnitId: "",
                          toUnitId: "",
                          conversionFactor: "",
                          conversionMethod: "standard",
                          effectiveFrom: "",
                          effectiveTo: "",
                          notes: "",
                          isActive: "true",
                        }),
                      afterSuccess: loadMaterialUnitConversions,
                    });
                  }}
                >
                  <select
                    name="materialId"
                    value={materialUnitConversionForm.materialId}
                    onChange={handleChange(setMaterialUnitConversionForm)}
                    style={styles.input}
                  >
                    <option value="">Select Material</option>
                    {safeMasters.materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.materialName}
                      </option>
                    ))}
                  </select>
                  <select
                    name="fromUnitId"
                    value={materialUnitConversionForm.fromUnitId}
                    onChange={handleChange(setMaterialUnitConversionForm)}
                    style={styles.input}
                  >
                    <option value="">From Unit</option>
                    {scopedUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unitCode} - {unit.unitName}
                      </option>
                    ))}
                  </select>
                  <select
                    name="toUnitId"
                    value={materialUnitConversionForm.toUnitId}
                    onChange={handleChange(setMaterialUnitConversionForm)}
                    style={styles.input}
                  >
                    <option value="">To Unit</option>
                    {scopedUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unitCode} - {unit.unitName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    name="conversionFactor"
                    placeholder="Conversion Factor"
                    value={materialUnitConversionForm.conversionFactor}
                    onChange={handleChange(setMaterialUnitConversionForm)}
                    style={styles.input}
                  />
                  <select
                    name="conversionMethod"
                    value={materialUnitConversionForm.conversionMethod}
                    onChange={handleChange(setMaterialUnitConversionForm)}
                    style={styles.input}
                  >
                    <option value="standard">Standard</option>
                    <option value="density_based">Density Based</option>
                    <option value="vehicle_capacity_based">Vehicle Capacity Based</option>
                    <option value="manual_defined">Manual Defined</option>
                  </select>
                  <input
                    type="date"
                    name="effectiveFrom"
                    value={materialUnitConversionForm.effectiveFrom}
                    onChange={handleChange(setMaterialUnitConversionForm)}
                    style={styles.input}
                  />
                  <input
                    type="date"
                    name="effectiveTo"
                    value={materialUnitConversionForm.effectiveTo}
                    onChange={handleChange(setMaterialUnitConversionForm)}
                    style={styles.input}
                  />
                  <select
                    name="isActive"
                    value={materialUnitConversionForm.isActive}
                    onChange={handleChange(setMaterialUnitConversionForm)}
                    style={styles.input}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <textarea
                    name="notes"
                    placeholder="Notes"
                    value={materialUnitConversionForm.notes}
                    onChange={handleChange(setMaterialUnitConversionForm)}
                    style={styles.textarea}
                  />
                  <button type="submit" style={styles.button} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Conversion"}
                  </button>
                </form>
              </div>
            )}
          </SectionCard>
        )}

        {shouldShowSection("shifts") && (
          <SectionCard title="Shifts">
            {renderWorkspaceHeader({
              title: "Shift Workspace",
              subtitle: "Daily operational time slots and work planning windows.",
              count: filteredShifts.length,
              listKey: "shifts",
              formOpen: openPanels.shift,
              onToggleForm: () => togglePanel("shift"),
              formButtonLabel: "Add Shift",
            })}

            {listVisibility.shifts && (
              <>
                {filteredShifts.length === 0 ? (
                  renderSectionEmpty(
                    "No shifts match this view",
                    "Shift templates appear here once configured, making report entry and scheduling cleaner across the workspace."
                  )
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Shift Name</th>
                          <th style={styles.th}>Start Time</th>
                          <th style={styles.th}>End Time</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredShifts.map((shift) => (
                          <tr key={shift.id}>
                            <td style={styles.td}>{shift.shiftName}</td>
                            <td style={styles.td}>{shift.startTime || "-"}</td>
                            <td style={styles.td}>{shift.endTime || "-"}</td>
                            <td style={styles.td}>{renderStatusBadge(shift.isActive)}</td>
                            <td style={styles.td}>{renderActions("shifts", shift)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {openPanels.shift && canManageMasters && (
              <div style={styles.compactFormShell}>
                <h3 style={styles.blockTitle}>Add Shift</h3>

                <form
                  style={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();

                    if (!shiftForm.shiftName || !shiftForm.startTime || !shiftForm.endTime) {
                      setError("Shift name, start time, and end time are required");
                      setSuccess("");
                      return;
                    }

                    handleCreate({
                      url: "/masters/shifts",
                      payload: shiftForm,
                      successMessage: "Shift added successfully",
                      reset: () =>
                        setShiftForm({
                          shiftName: "",
                          startTime: "",
                          endTime: "",
                        }),
                    });
                  }}
                >
                  <input
                    name="shiftName"
                    placeholder="Shift Name"
                    value={shiftForm.shiftName}
                    onChange={handleChange(setShiftForm)}
                    style={styles.input}
                  />
                  <input
                    type="time"
                    name="startTime"
                    value={shiftForm.startTime}
                    onChange={handleChange(setShiftForm)}
                    style={styles.input}
                  />
                  <input
                    type="time"
                    name="endTime"
                    value={shiftForm.endTime}
                    onChange={handleChange(setShiftForm)}
                    style={styles.input}
                  />
                  <button type="submit" style={styles.button} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Shift"}
                  </button>
                </form>
              </div>
            )}
          </SectionCard>
        )}

        {shouldShowSection("vehicleTypes") && (
          <SectionCard title="Vehicle Types">
            {renderWorkspaceHeader({
              title: "Vehicle Type Workspace",
              subtitle: "Fleet categories for operations, reporting, and future costing logic.",
              count: filteredVehicleTypes.length,
              listKey: "vehicleTypes",
              formOpen: openPanels.vehicleType,
              onToggleForm: () => togglePanel("vehicleType"),
              formButtonLabel: "Add Vehicle Type",
            })}

            {listVisibility.vehicleTypes && (
              <>
                {filteredVehicleTypes.length === 0 ? (
                  renderSectionEmpty(
                    "No vehicle types match this view",
                    "Vehicle type references help fleet records stay consistent, so add them here or broaden the current filters."
                  )
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Type Name</th>
                          <th style={styles.th}>Category</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVehicleTypes.map((type) => (
                          <tr key={type.id}>
                            <td style={styles.td}>{type.typeName}</td>
                            <td style={styles.td}>{type.category || "-"}</td>
                            <td style={styles.td}>{renderStatusBadge(type.isActive)}</td>
                            <td style={styles.td}>{renderActions("vehicleTypes", type)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {openPanels.vehicleType && canManageMasters && (
              <div style={styles.compactFormShell}>
                <h3 style={styles.blockTitle}>Add Vehicle Type</h3>

                <form
                  style={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();

                    const finalCategory = resolveOtherValue(
                      vehicleTypeForm.category,
                      vehicleTypeForm.categoryCustom
                    );

                    handleCreate({
                      url: "/masters/vehicle-types",
                      payload: {
                        typeName: vehicleTypeForm.typeName,
                        category: finalCategory,
                      },
                      successMessage: "Vehicle type added successfully",
                      reset: () =>
                        setVehicleTypeForm({
                          typeName: "",
                          category: "",
                          categoryCustom: "",
                        }),
                    });
                  }}
                >
                  <input
                    name="typeName"
                    placeholder="Type Name"
                    value={vehicleTypeForm.typeName}
                    onChange={handleChange(setVehicleTypeForm)}
                    style={styles.input}
                  />
                  <select
                    name="category"
                    value={vehicleTypeForm.category}
                    onChange={handleChange(setVehicleTypeForm)}
                    style={styles.input}
                  >
                    <option value="">Select Vehicle Category</option>
                    {renderOptionChoices(vehicleCategories)}
                    <option value="__other__">Other</option>
                  </select>
                  {vehicleTypeForm.category === "__other__" && (
                    <input
                      name="categoryCustom"
                      placeholder="Enter custom vehicle category"
                      value={vehicleTypeForm.categoryCustom}
                      onChange={handleChange(setVehicleTypeForm)}
                      style={styles.input}
                    />
                  )}
                  <button type="submit" style={styles.button} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Vehicle Type"}
                  </button>
                </form>
              </div>
            )}
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
      "radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 26%), radial-gradient(circle at bottom right, rgba(168,85,247,0.16), transparent 26%), linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
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
    background: "rgba(59,130,246,0.18)",
    filter: "blur(36px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-90px",
    left: "-30px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(168,85,247,0.16)",
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
  loadingBanner: {
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(37,99,235,0.08)",
  },
  readOnlyBanner: {
    background: "linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    padding: "12px 14px",
    borderRadius: "14px",
    fontSize: "13px",
    lineHeight: 1.6,
    marginBottom: "12px",
  },
  syncBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
    border: "1px solid rgba(59,130,246,0.12)",
    boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
    flexWrap: "wrap",
  },
  syncLabel: {
    margin: 0,
    color: "#1d4ed8",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.9px",
    textTransform: "uppercase",
  },
  syncValue: {
    display: "block",
    marginTop: "5px",
    color: "#0f172a",
    fontSize: "16px",
  },
  syncNote: {
    color: "#52606d",
    fontSize: "13px",
    lineHeight: 1.6,
    maxWidth: "560px",
    fontWeight: "600",
  },
  muted: {
    color: "#6b7280",
    margin: 0,
    fontSize: "14px",
  },
  healthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginTop: "16px",
  },
  healthCard: {
    borderRadius: "20px",
    padding: "18px",
    background: "linear-gradient(135deg, #fffdf8 0%, #ffffff 100%)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
    boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
  },
  healthLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  healthValue: {
    display: "block",
    marginTop: "10px",
    color: "#0f172a",
    fontSize: "28px",
    lineHeight: 1.1,
    fontWeight: "800",
  },
  healthNote: {
    margin: "8px 0 0",
    color: "#52606d",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  workspaceControlBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    padding: "6px 0",
  },
  workspaceControlCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  workspaceControlLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  workspaceControlValue: {
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
  },
  workspaceControlMeta: {
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  workspaceControlActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  inlineListCard: {
    marginTop: "14px",
    border: "1px solid #dbe3f0",
    borderRadius: "16px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    padding: "14px",
  },
  inlineListTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: "800",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  inlineList: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  inlineListItem: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px 12px",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  inlineListItemHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    flexWrap: "wrap",
  },
  inlineListItemTitle: {
    color: "#0f172a",
    fontSize: "14px",
    fontWeight: "700",
  },
  severityBadge: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid transparent",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.5px",
  },
  inlineListItemMeta: {
    color: "#52606d",
    fontSize: "12px",
    lineHeight: 1.55,
  },
  sampleChips: {
    marginTop: "4px",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  sampleChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
    fontSize: "11px",
    fontWeight: "700",
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
  summaryPurple: {
    background: "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)",
  },
  summaryCyan: {
    background: "linear-gradient(135deg, #cffafe 0%, #ecfeff 100%)",
  },
  summarySlate: {
    background: "linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)",
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
    marginBottom: "8px",
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
  filterMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  filterMetaText: {
    color: "#52606d",
    fontSize: "13px",
    fontWeight: "700",
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
    background: "#eef2ff",
    color: "#3730a3",
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
  editPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
  },
  textarea: {
    width: "100%",
    minHeight: "110px",
    padding: "13px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
    resize: "vertical",
    gridColumn: "1 / -1",
  },
  button: {
    padding: "12px 16px",
    border: "none",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "800",
    boxShadow: "0 12px 24px rgba(15,23,42,0.16)",
  },
  secondaryButton: {
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "700",
  },
  emptyStateCard: {
    padding: "20px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #fffdf8 0%, #f8fafc 100%)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
    marginTop: "14px",
  },
  emptyStateTitle: {
    display: "block",
    color: "#1f2933",
    fontSize: "16px",
    marginBottom: "8px",
  },
  emptyStateText: {
    margin: 0,
    color: "#52606d",
    lineHeight: 1.7,
    fontSize: "14px",
  },
  actionRow: {
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
    background: "#fff",
  },
  th: {
    textAlign: "left",
    padding: "15px 12px",
    borderBottom: "1px solid #e5e7eb",
    color: "#334155",
    fontSize: "13px",
    fontWeight: "800",
    background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
    fontSize: "14px",
    verticalAlign: "top",
  },
};

export default MastersPage;
