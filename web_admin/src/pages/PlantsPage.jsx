import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";

const OTHER_PREFIX_PATTERN = /^other\s*:\s*/i;
const isOtherCustomValue = (value) => OTHER_PREFIX_PATTERN.test(String(value || "").trim());
const getOtherCustomLabel = (value) =>
  String(value || "").trim().replace(OTHER_PREFIX_PATTERN, "").trim();
const buildOtherValue = (customValue) => `Other: ${String(customValue || "").trim()}`;
const getDisplayPlantType = (value) => {
  if (!isOtherCustomValue(value)) {
    return value || "-";
  }
  const custom = getOtherCustomLabel(value);
  return custom ? `Other (${custom})` : "Other";
};

const PLANT_TYPE_OPTIONS = [
  "Crusher Plant",
  "Stone Plant",
  "Dolomite Plant",
  "RMC Plant",
  "Asphalt Plant",
  "Warehouse",
  "Project Site",
  "Other",
];

const POWER_SOURCE_OPTIONS = [
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Electric" },
  { value: "hybrid", label: "Hybrid" },
  { value: "other", label: "Other" },
];

function PlantsPage() {
  const [plants, setPlants] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [formData, setFormData] = useState({
    plantName: "",
    plantCode: "",
    plantType: "",
    plantTypeCustom: "",
    location: "",
    powerSourceType: "diesel",
    powerSourceTypeCustom: "",
  });

  const [selectedPlant, setSelectedPlant] = useState(null);
  const [editForm, setEditForm] = useState({
    plantName: "",
    plantCode: "",
    plantType: "",
    plantTypeCustom: "",
    location: "",
    powerSourceType: "diesel",
    powerSourceTypeCustom: "",
  });

  async function loadPlants() {
    try {
      const res = await api.get("/plants");
      setPlants(res.data.data || []);
    } catch {
      setError("Failed to load plants");
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadPlants();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const filteredPlants = useMemo(() => {
    return plants.filter((plant) => {
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        plant.plantName?.toLowerCase().includes(q) ||
        plant.plantCode?.toLowerCase().includes(q) ||
        plant.location?.toLowerCase().includes(q);

      const matchesType = typeFilter ? plant.plantType === typeFilter : true;

      const matchesStatus =
        statusFilter === ""
          ? true
          : statusFilter === "active"
          ? plant.isActive
          : !plant.isActive;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [plants, searchTerm, typeFilter, statusFilter]);

  const filterPlantTypeOptions = useMemo(() => {
    const dynamicTypes = plants
      .map((plant) => String(plant.plantType || "").trim())
      .filter(Boolean);
    return Array.from(new Set([...PLANT_TYPE_OPTIONS, ...dynamicTypes])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [plants]);

  const handleChange = (setter) => (e) => {
    setter((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.plantName || !formData.plantType) {
      setError("Plant name and plant type are required");
      return;
    }

    if (
      formData.plantType === "Other" &&
      !String(formData.plantTypeCustom || "").trim()
    ) {
      setError("Please enter custom plant type when selecting Other");
      return;
    }

    if (
      formData.powerSourceType === "other" &&
      !String(formData.powerSourceTypeCustom || "").trim()
    ) {
      setError("Please enter custom power source when selecting Other");
      return;
    }

    const payload = {
      ...formData,
      plantType:
        formData.plantType === "Other"
          ? buildOtherValue(formData.plantTypeCustom)
          : formData.plantType,
      powerSourceType:
        formData.powerSourceType === "other"
          ? buildOtherValue(formData.powerSourceTypeCustom)
          : formData.powerSourceType,
    };

    delete payload.plantTypeCustom;
    delete payload.powerSourceTypeCustom;

    try {
      await api.post("/plants", payload);

      setSuccess("Plant added successfully");
      setFormData({
        plantName: "",
        plantCode: "",
        plantType: "",
        plantTypeCustom: "",
        location: "",
        powerSourceType: "diesel",
        powerSourceTypeCustom: "",
      });

      loadPlants();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add plant");
    }
  };

  const openEditPanel = (plant) => {
    const plantTypeRaw = String(plant.plantType || "");
    const powerSourceRaw = String(plant.powerSourceType || "").trim();
    const normalizedPowerSource = powerSourceRaw.toLowerCase();
    const hasCustomPlantType = isOtherCustomValue(plantTypeRaw);
    const hasCustomPowerSource = isOtherCustomValue(powerSourceRaw);

    setSelectedPlant(plant);
    setEditForm({
      plantName: plant.plantName || "",
      plantCode: plant.plantCode || "",
      plantType: hasCustomPlantType ? "Other" : plantTypeRaw || "",
      plantTypeCustom: hasCustomPlantType ? getOtherCustomLabel(plantTypeRaw) : "",
      location: plant.location || "",
      powerSourceType: hasCustomPowerSource
        ? "other"
        : normalizedPowerSource === "electricity"
        ? "electric"
        : normalizedPowerSource || "diesel",
      powerSourceTypeCustom: hasCustomPowerSource
        ? getOtherCustomLabel(powerSourceRaw)
        : "",
    });
    setError("");
    setSuccess("");
  };

  const handleEditSave = async () => {
    if (!selectedPlant) return;

    setError("");
    setSuccess("");

    if (!editForm.plantName.trim() || !editForm.plantType.trim()) {
      setError("Plant name and plant type are required");
      return;
    }

    if (
      editForm.plantType === "Other" &&
      !String(editForm.plantTypeCustom || "").trim()
    ) {
      setError("Please enter custom plant type when selecting Other");
      return;
    }

    if (
      editForm.powerSourceType === "other" &&
      !String(editForm.powerSourceTypeCustom || "").trim()
    ) {
      setError("Please enter custom power source when selecting Other");
      return;
    }

    const payload = {
      ...editForm,
      plantType:
        editForm.plantType === "Other"
          ? buildOtherValue(editForm.plantTypeCustom)
          : editForm.plantType,
      powerSourceType:
        editForm.powerSourceType === "other"
          ? buildOtherValue(editForm.powerSourceTypeCustom)
          : editForm.powerSourceType,
    };

    delete payload.plantTypeCustom;
    delete payload.powerSourceTypeCustom;

    try {
      await api.patch(`/plants/${selectedPlant.id}`, payload);
      setSuccess("Plant updated successfully");
      setSelectedPlant(null);
      loadPlants();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update plant");
    }
  };

  const handleToggleStatus = async (plant) => {
    setError("");
    setSuccess("");

    try {
      await api.patch(`/plants/${plant.id}/status`, {
        isActive: !plant.isActive,
      });

      setSuccess(
        plant.isActive
          ? "Plant deactivated successfully"
          : "Plant activated successfully"
      );
      loadPlants();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update plant status");
    }
  };

  return (
    <AppShell
      title="Plants"
      subtitle="Manage multiple plants, units, and future business operations"
    >
      <div style={styles.stack}>
        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        <SectionCard title="Add Plant / Unit">
          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              name="plantName"
              placeholder="Plant Name"
              value={formData.plantName}
              onChange={handleChange(setFormData)}
              style={styles.input}
            />

            <input
              name="plantCode"
              placeholder="Plant Code"
              value={formData.plantCode}
              onChange={handleChange(setFormData)}
              style={styles.input}
            />

            <select
              name="plantType"
              value={formData.plantType}
              onChange={handleChange(setFormData)}
              style={styles.input}
            >
              <option value="">Select Plant Type</option>
              {PLANT_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {formData.plantType === "Other" ? (
              <input
                name="plantTypeCustom"
                placeholder="Enter custom plant type"
                value={formData.plantTypeCustom}
                onChange={handleChange(setFormData)}
                style={styles.input}
              />
            ) : null}

            <input
              name="location"
              placeholder="Location"
              value={formData.location}
              onChange={handleChange(setFormData)}
              style={styles.input}
            />

            <select
              name="powerSourceType"
              value={formData.powerSourceType}
              onChange={handleChange(setFormData)}
              style={styles.input}
            >
              {POWER_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formData.powerSourceType === "other" ? (
              <input
                name="powerSourceTypeCustom"
                placeholder="Enter custom power source"
                value={formData.powerSourceTypeCustom}
                onChange={handleChange(setFormData)}
                style={styles.input}
              />
            ) : null}

            <button type="submit" style={styles.button}>
              Add Plant
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Search & Filters">
          <div style={styles.form}>
            <input
              placeholder="Search by plant name, code, or location"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.input}
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Plant Types</option>
              {filterPlantTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {getDisplayPlantType(type)}
                </option>
              ))}
            </select>
            {typeFilter === "Other" ? (
              <p style={styles.muted}>Custom plant types appear under list search and table view.</p>
            ) : null}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </SectionCard>

        <SectionCard title="Plant List">
          {filteredPlants.length === 0 ? (
            <p style={styles.muted}>No plants found.</p>
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
                      <td style={styles.td}>{getDisplayPlantType(plant.plantType)}</td>
                      <td style={styles.td}>{plant.location || "-"}</td>
                      <td style={styles.td}>{getDisplayPlantType(plant.powerSourceType)}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(plant.isActive ? styles.activeBadge : styles.inactiveBadge),
                          }}
                        >
                          {plant.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.inlineActions}>
                          <button
                            style={styles.smallButton}
                            onClick={() => openEditPanel(plant)}
                          >
                            Edit
                          </button>
                          <button
                            style={styles.smallButton}
                            onClick={() => handleToggleStatus(plant)}
                          >
                            {plant.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {selectedPlant && (
          <SectionCard title={`Edit Plant — ${selectedPlant.plantName}`}>
            <div style={styles.form}>
              <input
                name="plantName"
                placeholder="Plant Name"
                value={editForm.plantName}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />

              <input
                name="plantCode"
                placeholder="Plant Code"
                value={editForm.plantCode}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />

              <select
                name="plantType"
                value={editForm.plantType}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                <option value="">Select Plant Type</option>
                {PLANT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {editForm.plantType === "Other" ? (
                <input
                  name="plantTypeCustom"
                  placeholder="Enter custom plant type"
                  value={editForm.plantTypeCustom}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                />
              ) : null}

              <input
                name="location"
                placeholder="Location"
                value={editForm.location}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />

              <select
                name="powerSourceType"
                value={editForm.powerSourceType}
                onChange={handleChange(setEditForm)}
                style={styles.input}
            >
              {POWER_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {editForm.powerSourceType === "other" ? (
              <input
                name="powerSourceTypeCustom"
                placeholder="Enter custom power source"
                value={editForm.powerSourceTypeCustom}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />
            ) : null}
            </div>

            <div style={styles.editActions}>
              <button style={styles.button} onClick={handleEditSave}>
                Save Changes
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => setSelectedPlant(null)}
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
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
  },
  button: {
    padding: "12px 16px",
    border: "none",
    borderRadius: "10px",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "600",
  },
  secondaryButton: {
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "600",
  },
  smallButton: {
    padding: "8px 12px",
    border: "none",
    borderRadius: "8px",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
  },
  inlineActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  editActions: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
  },
  statusBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  activeBadge: {
    background: "#dcfce7",
    color: "#166534",
  },
  inactiveBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  error: {
    color: "#dc2626",
    margin: 0,
  },
  success: {
    color: "#059669",
    margin: 0,
  },
  muted: {
    color: "#6b7280",
    margin: 0,
    fontSize: "14px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "14px",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
    fontSize: "14px",
    verticalAlign: "top",
  },
};

export default PlantsPage;
