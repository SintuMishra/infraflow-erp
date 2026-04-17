import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";

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
    location: "",
    powerSourceType: "diesel",
  });

  const [selectedPlant, setSelectedPlant] = useState(null);
  const [editForm, setEditForm] = useState({
    plantName: "",
    plantCode: "",
    plantType: "",
    location: "",
    powerSourceType: "diesel",
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

  const plantTypes = [
    "Crusher Plant",
    "Stone Plant",
    "Dolomite Plant",
    "RMC Plant",
    "Asphalt Plant",
    "Warehouse",
    "Project Site",
    "Other",
  ];

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

    try {
      await api.post("/plants", formData);

      setSuccess("Plant added successfully");
      setFormData({
        plantName: "",
        plantCode: "",
        plantType: "",
        location: "",
        powerSourceType: "diesel",
      });

      loadPlants();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add plant");
    }
  };

  const openEditPanel = (plant) => {
    setSelectedPlant(plant);
    setEditForm({
      plantName: plant.plantName || "",
      plantCode: plant.plantCode || "",
      plantType: plant.plantType || "",
      location: plant.location || "",
      powerSourceType: plant.powerSourceType || "diesel",
    });
    setError("");
    setSuccess("");
  };

  const handleEditSave = async () => {
    if (!selectedPlant) return;

    setError("");
    setSuccess("");

    try {
      await api.patch(`/plants/${selectedPlant.id}`, editForm);
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
              {plantTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

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
              <option value="diesel">Diesel</option>
              <option value="electricity">Electricity</option>
              <option value="hybrid">Hybrid</option>
            </select>

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
              {plantTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
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
                      <td style={styles.td}>{plant.plantType}</td>
                      <td style={styles.td}>{plant.location || "-"}</td>
                      <td style={styles.td}>{plant.powerSourceType || "-"}</td>
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
                {plantTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

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
                <option value="diesel">Diesel</option>
                <option value="electricity">Electricity</option>
                <option value="hybrid">Hybrid</option>
              </select>
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
