import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useAuth } from "../hooks/useAuth";

const formatMetric = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const OTHER_PREFIX_PATTERN = /^other\s*:\s*/i;
const isOtherCustomValue = (value) => OTHER_PREFIX_PATTERN.test(String(value || "").trim());
const getOtherCustomLabel = (value) =>
  String(value || "").trim().replace(OTHER_PREFIX_PATTERN, "").trim();
const buildOtherValue = (customValue) => `Other: ${String(customValue || "").trim()}`;
const getDisplayVendorType = (value) => {
  if (!isOtherCustomValue(value)) {
    return value || "-";
  }
  const custom = getOtherCustomLabel(value);
  return custom ? `Other (${custom})` : "Other";
};

const VENDOR_TYPE_OPTIONS = [
  "Transporter",
  "Equipment Supplier",
  "Manpower Supplier",
  "Consultant",
  "Subcontractor",
  "Other",
];

const createVendorFormState = () => ({
  vendorName: "",
  vendorType: "",
  vendorTypeCustom: "",
  contactPerson: "",
  mobileNumber: "",
  address: "",
});

function VendorsPage() {
  const { currentUser } = useAuth();
  const canManageVendors = ["super_admin", "manager"].includes(
    String(currentUser?.role || "")
  );
  const [vendors, setVendors] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showVendorList, setShowVendorList] = useState(true);
  const [showVendorForm, setShowVendorForm] = useState(false);

  const [formData, setFormData] = useState(createVendorFormState);

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [editForm, setEditForm] = useState(createVendorFormState);

  const filterVendorTypeOptions = useMemo(() => {
    const dynamic = vendors
      .map((vendor) => String(vendor.vendorType || "").trim())
      .filter(Boolean);
    return Array.from(new Set([...VENDOR_TYPE_OPTIONS, ...dynamic])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [vendors]);

  useEffect(() => {
    const hasSearch =
      searchTerm.trim() !== "" || typeFilter !== "" || statusFilter !== "";

    if (hasSearch) {
      const timeoutId = window.setTimeout(() => {
        setShowVendorList(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [searchTerm, typeFilter, statusFilter]);

  async function loadVendors() {
    setIsLoadingData(true);

    try {
      const res = await api.get("/vendors");
      setVendors(res.data.data || []);
      setLastLoadedAt(Date.now());
      setError("");
    } catch {
      setError("Failed to load vendors");
    } finally {
      setIsLoadingData(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadVendors();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        vendor.vendorName?.toLowerCase().includes(q) ||
        vendor.vendorType?.toLowerCase().includes(q) ||
        vendor.contactPerson?.toLowerCase().includes(q) ||
        vendor.mobileNumber?.toLowerCase().includes(q) ||
        vendor.address?.toLowerCase().includes(q);

      const matchesType = typeFilter ? vendor.vendorType === typeFilter : true;

      const matchesStatus =
        statusFilter === ""
          ? true
          : statusFilter === "active"
          ? vendor.isActive
          : !vendor.isActive;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [vendors, searchTerm, typeFilter, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: vendors.length,
      active: vendors.filter((vendor) => vendor.isActive).length,
      inactive: vendors.filter((vendor) => !vendor.isActive).length,
      transporters: vendors.filter(
        (vendor) => vendor.vendorType === "Transporter"
      ).length,
    };
  }, [vendors]);

  const filteredSummary = useMemo(() => {
    return {
      count: filteredVendors.length,
      active: filteredVendors.filter((vendor) => vendor.isActive).length,
      transporters: filteredVendors.filter(
        (vendor) => vendor.vendorType === "Transporter"
      ).length,
      withContacts: filteredVendors.filter((vendor) =>
        Boolean(String(vendor.contactPerson || "").trim() || String(vendor.mobileNumber || "").trim())
      ).length,
    };
  }, [filteredVendors]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() || typeFilter || statusFilter
  );

  const formReadiness = useMemo(() => {
    const checks = [
      {
        label: "Vendor name entered",
        ready: Boolean(formData.vendorName.trim()),
      },
      {
        label: "Vendor type selected",
        ready: Boolean(formData.vendorType.trim()),
      },
      {
        label: "Contact channel available",
        ready: Boolean(formData.contactPerson.trim() || formData.mobileNumber.trim()),
      },
      {
        label: "Address noted",
        ready: Boolean(formData.address.trim()),
      },
    ];

    const missingItems = checks
      .filter((check) => !check.ready)
      .map((check) => check.label);

    return {
      isReady: missingItems.length === 0,
      missingItems,
    };
  }, [formData]);

  const syncLabel = lastLoadedAt
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(lastLoadedAt))
    : "Waiting for first sync";

  const logisticsWorkflow = [
    {
      label: "1. Vendor Setup",
      title: "Create transporter and supplier records",
      text: "Start here when a new transporter or supplier needs to be available across fleet and dispatch workflows.",
      to: "/vendors",
      action: "Current Workspace",
    },
    {
      label: "2. Vehicle Linkage",
      title: "Attach vendors to transporter vehicles",
      text: "Link vendor-owned vehicles so dispatch can inherit the transporter without operators filling the same detail twice.",
      to: "/vehicles",
      action: "Open Vehicles",
    },
    {
      label: "3. Costing Setup",
      title: "Activate transport rates",
      text: "Create plant and material-wise transport rates so dispatch billing is ready once the vehicle gets selected.",
      to: "/transport-rates",
      action: "Open Rates",
    },
  ];

  const handleChange = (setter) => (e) => {
    setter((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.vendorName || !formData.vendorType) {
      setError("Vendor name and vendor type are required");
      return;
    }

    if (
      formData.vendorType === "Other" &&
      !String(formData.vendorTypeCustom || "").trim()
    ) {
      setError("Please enter custom vendor type when selecting Other");
      return;
    }

    const payload = {
      ...formData,
      vendorType:
        formData.vendorType === "Other"
          ? buildOtherValue(formData.vendorTypeCustom)
          : formData.vendorType,
    };
    delete payload.vendorTypeCustom;

    try {
      setIsSubmitting(true);
      await api.post("/vendors", payload);

      setSuccess("Vendor added successfully");
      setFormData(createVendorFormState());

      setShowVendorForm(false);
      await loadVendors();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add vendor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditPanel = (vendor) => {
    const rawVendorType = String(vendor.vendorType || "");
    const hasCustomVendorType = isOtherCustomValue(rawVendorType);
    setSelectedVendor(vendor);
    setEditForm({
      vendorName: vendor.vendorName || "",
      vendorType: hasCustomVendorType ? "Other" : rawVendorType || "",
      vendorTypeCustom: hasCustomVendorType
        ? getOtherCustomLabel(rawVendorType)
        : "",
      contactPerson: vendor.contactPerson || "",
      mobileNumber: vendor.mobileNumber || "",
      address: vendor.address || "",
    });
    setError("");
    setSuccess("");
  };

  const handleEditSave = async () => {
    if (!selectedVendor) return;

    setError("");
    setSuccess("");

    if (
      editForm.vendorType === "Other" &&
      !String(editForm.vendorTypeCustom || "").trim()
    ) {
      setError("Please enter custom vendor type when selecting Other");
      return;
    }

    const payload = {
      ...editForm,
      vendorType:
        editForm.vendorType === "Other"
          ? buildOtherValue(editForm.vendorTypeCustom)
          : editForm.vendorType,
    };
    delete payload.vendorTypeCustom;

    try {
      setIsUpdating(true);
      await api.patch(`/vendors/${selectedVendor.id}`, payload);
      setSuccess("Vendor updated successfully");
      setSelectedVendor(null);
      await loadVendors();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update vendor");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (vendor) => {
    setError("");
    setSuccess("");

    try {
      setStatusUpdatingId(vendor.id);
      await api.patch(`/vendors/${vendor.id}/status`, {
        isActive: !vendor.isActive,
      });

      setSuccess(
        vendor.isActive
          ? "Vendor deactivated successfully"
          : "Vendor activated successfully"
      );
      await loadVendors();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update vendor status"
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const resetWorkspaceView = () => {
    setSearchTerm("");
    setTypeFilter("");
    setStatusFilter("");
    setShowVendorList(false);
    setShowVendorForm(false);
    setSelectedVendor(null);
    setFormData(createVendorFormState());
    setEditForm(createVendorFormState());
    setError("");
    setSuccess("");
  };

  return (
    <AppShell
      title="Vendors & Transporters"
      subtitle="Manage transporters, suppliers, agencies, and external vendors in one practical workspace"
    >
      <div style={styles.pageStack}>
        <div style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.heroContent}>
            <div>
              <p style={styles.heroEyebrow}>External Party Management</p>
              <h1 style={styles.heroTitle}>Vendor Control Center</h1>
              <p style={styles.heroText}>
                Manage transporters, suppliers, subcontractors, consultants, and
                external business parties with a cleaner, list-first vendor workspace.
              </p>
            </div>

            <div style={styles.heroPills}>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>Operational Role</span>
                <strong style={styles.heroPillValue}>Fleet + dispatch support</strong>
              </div>
              <div style={styles.heroPill}>
                <span style={styles.heroPillLabel}>UX Pattern</span>
                <strong style={styles.heroPillValue}>Search first, form second</strong>
              </div>
            </div>
          </div>
        </div>

        {error && <div style={styles.messageError}>{error}</div>}
        {success && <div style={styles.messageSuccess}>{success}</div>}
        {isLoadingData && (
          <div style={styles.loadingBanner}>
            Refreshing vendors, transporters, and external party records...
          </div>
        )}

        <SectionCard title="Workspace Health">
          <div style={styles.syncBanner}>
            <div>
              <p style={styles.syncLabel}>Vendor Registry Sync</p>
              <strong style={styles.syncValue}>
                {isLoadingData ? "Refreshing vendor registry..." : `Last sync: ${syncLabel}`}
              </strong>
            </div>
            <span style={styles.syncNote}>
              Vendor records are a shared dependency for fleet linkage, transport costing, and downstream dispatch workflows.
            </span>
          </div>

          <div style={styles.healthGrid}>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Visible Records</span>
              <strong style={styles.healthValue}>{formatMetric(filteredSummary.count)}</strong>
              <p style={styles.healthNote}>Records currently visible in this filtered workspace</p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Visible Active</span>
              <strong style={styles.healthValue}>{formatMetric(filteredSummary.active)}</strong>
              <p style={styles.healthNote}>Vendors currently usable in live operations</p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>Transporters</span>
              <strong style={styles.healthValue}>{formatMetric(filteredSummary.transporters)}</strong>
              <p style={styles.healthNote}>Transport vendors available for fleet and dispatch linkage</p>
            </div>
            <div style={styles.healthCard}>
              <span style={styles.healthLabel}>With Contacts</span>
              <strong style={styles.healthValue}>{formatMetric(filteredSummary.withContacts)}</strong>
              <p style={styles.healthNote}>Filtered records carrying a usable contact channel</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Connected Workflow">
          <p style={styles.sectionSubtitle}>
            In production use, vendors, vehicles, and transport rates are one logistics flow. Use this order when onboarding a new transporter for dispatch.
          </p>

          <div style={styles.workflowGrid}>
            {logisticsWorkflow.map((step) => (
              <div key={step.label} style={styles.workflowCard}>
                <span style={styles.workflowStep}>{step.label}</span>
                <strong style={styles.workflowTitle}>{step.title}</strong>
                <p style={styles.workflowText}>{step.text}</p>
                <Link to={step.to} style={styles.workflowLink}>
                  {step.action}
                </Link>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Overview">
          <div style={styles.summaryGrid}>
            <div style={{ ...styles.summaryCard, ...styles.summaryBlue }}>
              <span style={styles.summaryTag}>Total</span>
              <p style={styles.summaryLabel}>All Vendors</p>
              <h3 style={styles.summaryValue}>{summary.total}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryGreen }}>
              <span style={styles.summaryTag}>Active</span>
              <p style={styles.summaryLabel}>Active Vendors</p>
              <h3 style={styles.summaryValue}>{summary.active}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryRose }}>
              <span style={styles.summaryTag}>Inactive</span>
              <p style={styles.summaryLabel}>Inactive Vendors</p>
              <h3 style={styles.summaryValue}>{summary.inactive}</h3>
            </div>

            <div style={{ ...styles.summaryCard, ...styles.summaryAmber }}>
              <span style={styles.summaryTag}>Transporters</span>
              <p style={styles.summaryLabel}>Transporter Records</p>
              <h3 style={styles.summaryValue}>{summary.transporters}</h3>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Workspace Controls">
          <div style={styles.workspaceControlBar}>
            <div style={styles.workspaceControlCopy}>
              <span style={styles.workspaceControlLabel}>Current View</span>
              <strong style={styles.workspaceControlValue}>
                {searchTerm.trim() || typeFilter || statusFilter
                  ? "Filtered vendor workspace"
                  : "All vendors"}
              </strong>
              <span style={styles.workspaceControlMeta}>
                Search: {searchTerm.trim() || "none"} | Type: {typeFilter || "all"} | Status: {statusFilter || "all"}
              </span>
            </div>

            <div style={styles.workspaceControlActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={resetWorkspaceView}
                disabled={isSubmitting || isUpdating || Boolean(statusUpdatingId)}
              >
                Reset View
              </button>
              <button
                type="button"
                style={styles.button}
                onClick={loadVendors}
                disabled={isLoadingData || isSubmitting || isUpdating}
              >
                {isLoadingData ? "Refreshing..." : "Refresh Vendors"}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Search & Filters">
          <p style={styles.sectionSubtitle}>
            Search by vendor name, type, contact person, mobile number, or address.
          </p>

          <div style={styles.form}>
            <input
              placeholder="Search vendors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.input}
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Types</option>
              {filterVendorTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {getDisplayVendorType(type)}
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

          <div style={styles.filterMetaRow}>
            <span style={styles.filterMetaText}>
              Showing {formatMetric(filteredSummary.count)} records • {formatMetric(filteredSummary.transporters)} transporters • {formatMetric(filteredSummary.withContacts)} with contacts
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setSearchTerm("");
                  setTypeFilter("");
                  setStatusFilter("");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Vendor Workspace">
          {!canManageVendors && (
            <div style={styles.readOnlyBanner}>
              This role can review transporter and supplier records, but creating, editing, and status changes are restricted to commercial administrators.
            </div>
          )}

          <div style={styles.workspaceHeader}>
            <div style={styles.workspaceTitleWrap}>
              <div style={styles.workspaceTitleRow}>
                <h3 style={styles.blockTitle}>Vendor List</h3>
                {renderCountBadge(filteredVendors.length)}
              </div>
              <p style={styles.blockSubtitle}>
                Daily users can review vendor records first and only open the create form when needed.
              </p>
            </div>

            <div style={styles.workspaceActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setShowVendorList((prev) => !prev)}
                disabled={isSubmitting || isUpdating || Boolean(statusUpdatingId)}
              >
                {showVendorList ? "Hide List" : "Show List"}
              </button>

              <button
                type="button"
                style={showVendorForm ? styles.secondaryButton : styles.button}
                onClick={() => setShowVendorForm((prev) => !prev)}
                disabled={!canManageVendors || isSubmitting || isUpdating || Boolean(statusUpdatingId)}
              >
                {showVendorForm ? "Hide Form" : "Add Vendor"}
              </button>
            </div>
          </div>

          {showVendorList && (
            <>
              {filteredVendors.length === 0 ? (
                <div style={styles.emptyStateCard}>
                  <strong style={styles.emptyStateTitle}>
                    {hasActiveFilters
                      ? "No vendors match the current filters"
                      : "No vendors found yet"}
                  </strong>
                  <p style={styles.emptyStateText}>
                    {hasActiveFilters
                      ? "Broaden your search, vendor type, or status filters to surface the right external party record."
                      : "Once vendors are added, they will appear here for transport, supplier, consultant, and subcontractor workflows."}
                  </p>
                </div>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Vendor Name</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Contact Person</th>
                        <th style={styles.th}>Mobile</th>
                        <th style={styles.th}>Address</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVendors.map((vendor) => (
                        <tr key={vendor.id}>
                          <td style={styles.td}>{vendor.vendorName}</td>
                          <td style={styles.td}>
                            {getDisplayVendorType(vendor.vendorType)}
                          </td>
                          <td style={styles.td}>{vendor.contactPerson || "-"}</td>
                          <td style={styles.td}>{vendor.mobileNumber || "-"}</td>
                          <td style={styles.td}>{vendor.address || "-"}</td>
                          <td style={styles.td}>
                            {renderStatusBadge(vendor.isActive)}
                          </td>
                          <td style={styles.td}>
                            <div style={styles.actionsInline}>
                              <button
                                type="button"
                                style={styles.smallButton}
                                onClick={() => openEditPanel(vendor)}
                                disabled={!canManageVendors || isSubmitting || isUpdating || Boolean(statusUpdatingId)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...styles.smallButton,
                                  ...(vendor.isActive
                                    ? styles.warnButton
                                    : styles.successButton),
                                }}
                                onClick={() => handleToggleStatus(vendor)}
                                disabled={!canManageVendors || isSubmitting || isUpdating || Boolean(statusUpdatingId)}
                              >
                                {statusUpdatingId === vendor.id
                                  ? "Updating..."
                                  : vendor.isActive
                                    ? "Deactivate"
                                    : "Activate"}
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

          {showVendorForm && canManageVendors && (
            <div style={styles.compactFormShell}>
              <h3 style={styles.blockTitle}>Add Vendor / Transporter</h3>
              <p style={styles.blockSubtitle}>
                Create a reusable external party record for vehicles, dispatch,
                vendor tracking, and future cost calculations.
              </p>

              <form onSubmit={handleSubmit} style={styles.form}>
                <div
                  style={{
                    ...styles.readinessStrip,
                    ...(formReadiness.isReady
                      ? styles.readinessOk
                      : styles.readinessWarn),
                    gridColumn: "1 / -1",
                  }}
                >
                  <strong>
                    {formReadiness.isReady
                      ? "Ready for operational linking"
                      : "A few vendor details are still weak"}
                  </strong>
                  <span>
                    {formReadiness.isReady
                      ? "This vendor record has the essentials usually needed for fleet, transport, and commercial workflows."
                      : formReadiness.missingItems.join(" • ")}
                  </span>
                </div>

                <input
                  name="vendorName"
                  placeholder="Vendor Name"
                  value={formData.vendorName}
                  onChange={handleChange(setFormData)}
                  style={styles.input}
                />

                <select
                  name="vendorType"
                  value={formData.vendorType}
                  onChange={handleChange(setFormData)}
                  style={styles.input}
                >
                  <option value="">Select Vendor Type</option>
                  {VENDOR_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {formData.vendorType === "Other" ? (
                  <input
                    name="vendorTypeCustom"
                    placeholder="Enter custom vendor type"
                    value={formData.vendorTypeCustom}
                    onChange={handleChange(setFormData)}
                    style={styles.input}
                  />
                ) : null}

                <input
                  name="contactPerson"
                  placeholder="Contact Person"
                  value={formData.contactPerson}
                  onChange={handleChange(setFormData)}
                  style={styles.input}
                />

                <input
                  name="mobileNumber"
                  placeholder="Mobile Number"
                  value={formData.mobileNumber}
                  onChange={handleChange(setFormData)}
                  style={styles.input}
                />

                <input
                  name="address"
                  placeholder="Address"
                  value={formData.address}
                  onChange={handleChange(setFormData)}
                  style={{ ...styles.input, gridColumn: "1 / -1" }}
                />

                <button type="submit" style={styles.button} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Add Vendor"}
                </button>
              </form>
            </div>
          )}
        </SectionCard>

        {selectedVendor && canManageVendors && (
          <SectionCard title={`Edit Vendor — ${selectedVendor.vendorName}`}>
            <div style={styles.editHeader}>
              <h3 style={styles.editTitle}>Update selected vendor</h3>
              <p style={styles.editSubtitle}>
                Edit the vendor carefully and save the changes.
              </p>
            </div>

            <div style={styles.form}>
              <input
                name="vendorName"
                placeholder="Vendor Name"
                value={editForm.vendorName}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />

              <select
                name="vendorType"
                value={editForm.vendorType}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              >
                <option value="">Select Vendor Type</option>
                {VENDOR_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {editForm.vendorType === "Other" ? (
                <input
                  name="vendorTypeCustom"
                  placeholder="Enter custom vendor type"
                  value={editForm.vendorTypeCustom}
                  onChange={handleChange(setEditForm)}
                  style={styles.input}
                />
              ) : null}

              <input
                name="contactPerson"
                placeholder="Contact Person"
                value={editForm.contactPerson}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />

              <input
                name="mobileNumber"
                placeholder="Mobile Number"
                value={editForm.mobileNumber}
                onChange={handleChange(setEditForm)}
                style={styles.input}
              />

              <input
                name="address"
                placeholder="Address"
                value={editForm.address}
                onChange={handleChange(setEditForm)}
                style={{ ...styles.input, gridColumn: "1 / -1" }}
              />
            </div>

            <div style={styles.editActions}>
              <button
                type="button"
                style={styles.button}
                onClick={handleEditSave}
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setSelectedVendor(null)}
                disabled={isUpdating}
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
      "radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 26%), radial-gradient(circle at bottom right, rgba(99,102,241,0.16), transparent 26%), linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
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
    background: "rgba(14,165,233,0.18)",
    filter: "blur(36px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-90px",
    left: "-30px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(99,102,241,0.16)",
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
  syncBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)",
    border: "1px solid rgba(99,102,241,0.14)",
    boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
    flexWrap: "wrap",
  },
  syncLabel: {
    margin: 0,
    color: "#4f46e5",
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
  workspaceControlBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
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
  workflowGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  workflowCard: {
    borderRadius: "20px",
    border: "1px solid rgba(148,163,184,0.18)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
    padding: "18px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  workflowStep: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    color: "#0f766e",
  },
  workflowTitle: {
    fontSize: "16px",
    color: "#0f172a",
    fontWeight: "800",
  },
  workflowText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
    fontSize: "14px",
    flex: 1,
  },
  workflowLink: {
    display: "inline-flex",
    alignSelf: "flex-start",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(15,118,110,0.10)",
    color: "#0f766e",
    fontWeight: "700",
    textDecoration: "none",
  },
  readOnlyBanner: {
    marginBottom: "16px",
    background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    color: "#92400e",
    border: "1px solid rgba(245,158,11,0.28)",
    padding: "14px 16px",
    borderRadius: "16px",
    fontSize: "14px",
    lineHeight: 1.6,
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
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  readinessStrip: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid transparent",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  readinessOk: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
    borderColor: "#a7f3d0",
    color: "#047857",
  },
  readinessWarn: {
    background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
    borderColor: "#fdba74",
    color: "#9a3412",
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
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
  actionsInline: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  editActions: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
    flexWrap: "wrap",
  },
  muted: {
    color: "#6b7280",
    margin: 0,
    fontSize: "14px",
  },
  emptyStateCard: {
    padding: "20px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #fffdf8 0%, #f8fafc 100%)",
    border: "1px solid rgba(148, 131, 107, 0.14)",
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
};

export default VendorsPage;
