import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useAuth } from "../hooks/useAuth";
import { useMasters } from "../hooks/useMasters";
import {
  formatDisplayDate,
  getTodayDateValue,
  getTimestampFileLabel,
  toDateOnlyValue,
} from "../utils/date";

const todayDate = getTodayDateValue();
const REPORT_STATUS_OPTIONS = [
  { value: "on_track", label: "On Track" },
  { value: "watch", label: "Watch" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
];
const SHIFT_OPTIONS = [
  { value: "", label: "Not Set" },
  { value: "general", label: "General" },
  { value: "day", label: "Day" },
  { value: "night", label: "Night" },
];
const WEATHER_OPTIONS = [
  { value: "", label: "Not Set" },
  { value: "clear", label: "Clear" },
  { value: "cloudy", label: "Cloudy" },
  { value: "rain", label: "Rain" },
  { value: "windy", label: "Windy" },
  { value: "heat", label: "Heat" },
];
const DATE_RANGES = [
  { label: "Today", days: 0 },
  { label: "Last 7 Days", days: 6 },
  { label: "Last 30 Days", days: 29 },
  { label: "All Time", days: null },
];

const INITIAL_FORM = {
  reportDate: todayDate,
  plantId: "",
  projectName: "",
  siteName: "",
  shift: "general",
  weather: "",
  reportStatus: "on_track",
  progressPercent: "",
  workDone: "",
  labourCount: "",
  machineCount: "",
  materialUsed: "",
  blockers: "",
  nextPlan: "",
  remarks: "",
};

const INITIAL_SECTION_VISIBILITY = {
  snapshot: true,
  controls: true,
  analytics: true,
  attention: true,
  form: true,
  reports: true,
};

function ProjectReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { masters, loadingMasters, mastersError } = useMasters();
  const canManageProjectReports = ["super_admin", "manager", "site_engineer"].includes(
    String(currentUser?.role || "")
  );
  const initialFilters = useMemo(
    () => parseProjectReportQuery(location.search),
    [location.search]
  );

  const [reports, setReports] = useState([]);
  const [serverSummary, setServerSummary] = useState(buildSummary([]));
  const [lookups, setLookups] = useState({
    projectNames: [],
    siteNames: [],
    reportStatuses: [],
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [search, setSearch] = useState(initialFilters.search);
  const [plants, setPlants] = useState([]);
  const [plantFilter, setPlantFilter] = useState(initialFilters.plantFilter);
  const [projectFilter, setProjectFilter] = useState(initialFilters.projectFilter);
  const [siteFilter, setSiteFilter] = useState(initialFilters.siteFilter);
  const [reportStatusFilter, setReportStatusFilter] = useState(initialFilters.reportStatusFilter);
  const [startDate, setStartDate] = useState(initialFilters.startDate);
  const [endDate, setEndDate] = useState(initialFilters.endDate);
  const [activeWindow, setActiveWindow] = useState(initialFilters.activeWindow);
  const [page, setPage] = useState(initialFilters.page);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [editingReportId, setEditingReportId] = useState(null);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [sectionVisibility, setSectionVisibility] = useState(INITIAL_SECTION_VISIBILITY);

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setSearch(initialFilters.search);
    setPlantFilter(initialFilters.plantFilter);
    setProjectFilter(initialFilters.projectFilter);
    setSiteFilter(initialFilters.siteFilter);
    setReportStatusFilter(initialFilters.reportStatusFilter);
    setStartDate(initialFilters.startDate);
    setEndDate(initialFilters.endDate);
    setActiveWindow(initialFilters.activeWindow);
    setPage(initialFilters.page);
  }, [initialFilters]);

  useEffect(() => {
    const nextSearch = buildProjectReportQueryString({
      search,
      plantFilter,
      projectFilter,
      siteFilter,
      reportStatusFilter,
      startDate,
      endDate,
      activeWindow,
      page,
    });

    const currentSearch = location.search.startsWith("?")
      ? location.search.slice(1)
      : location.search;

    if (nextSearch === currentSearch) {
      return;
    }

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true }
    );
  }, [
    activeWindow,
    endDate,
    location.pathname,
    location.search,
    navigate,
    page,
    plantFilter,
    projectFilter,
    reportStatusFilter,
    search,
    siteFilter,
    startDate,
  ]);

  async function loadReports(filters = {}) {
    setLoadingReports(true);

    try {
      const response = await api.get("/project-reports", {
        params: {
          search: filters.search || undefined,
          plantId: filters.plantId || undefined,
          projectName: filters.projectName || undefined,
          siteName: filters.siteName || undefined,
          reportStatus: filters.reportStatus || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          page: filters.page || 1,
          limit: 25,
        },
      });

      setReports(response.data?.data || []);
      setServerSummary(response.data?.meta?.summary || buildSummary([]));
      setLookups(
        response.data?.meta?.lookups || {
          projectNames: [],
          siteNames: [],
          reportStatuses: [],
        }
      );
      setPagination(
        response.data?.meta?.pagination || {
          total: 0,
          page: 1,
          limit: 25,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        }
      );
      setError("");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load project reports");
    } finally {
      setLoadingReports(false);
    }
  }

  async function loadPlants() {
    try {
      const response = await api.get("/plants");
      setPlants(response.data?.data || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load plants");
    }
  }

  useEffect(() => {
    loadPlants();
  }, []);

  useEffect(() => {
    loadReports({
      search: deferredSearch,
      plantId: plantFilter,
      projectName: projectFilter,
      siteName: siteFilter,
      reportStatus: reportStatusFilter,
      startDate,
      endDate,
      page,
    });
  }, [deferredSearch, endDate, page, plantFilter, projectFilter, reportStatusFilter, siteFilter, startDate]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, endDate, plantFilter, projectFilter, reportStatusFilter, siteFilter, startDate]);

  const normalizedReports = useMemo(() => {
    return reports.map((report) => ({
      ...report,
      reportDateValue: toDateOnlyValue(report.reportDate),
      labourCount: Number(report.labourCount || 0),
      machineCount: Number(report.machineCount || 0),
      progressPercent:
        report.progressPercent === null || report.progressPercent === undefined
          ? null
          : Number(report.progressPercent),
    }));
  }, [reports]);

  const reportStatusOptions = useMemo(() => {
    const fromServer = (lookups.reportStatuses || []).map((status) => ({
      value: status,
      label: formatReportStatusLabel(status),
    }));
    const merged = [...REPORT_STATUS_OPTIONS, ...fromServer].reduce((accumulator, option) => {
      if (!accumulator.find((entry) => entry.value === option.value)) {
        accumulator.push(option);
      }

      return accumulator;
    }, []);

    return merged;
  }, [lookups.reportStatuses]);

  const reportPlantOptions = useMemo(
    () =>
      plants
        .filter(
          (plant) =>
            plant.isActive ||
            String(plant.id) === String(formData.plantId) ||
            String(plant.id) === String(plantFilter)
        )
        .sort((left, right) => String(left.plantName || "").localeCompare(String(right.plantName || ""))),
    [formData.plantId, plantFilter, plants]
  );

  const selectedPlant = useMemo(
    () => reportPlantOptions.find((plant) => String(plant.id) === String(formData.plantId)) || null,
    [formData.plantId, reportPlantOptions]
  );

  const shiftOptions = useMemo(() => {
    const masterShiftOptions = (masters?.shifts || []).map((shift) => ({
      value: String(shift.shiftName || "").trim().toLowerCase().replace(/\s+/g, "_"),
      label: shift.shiftName,
    }));

    return [...SHIFT_OPTIONS, ...masterShiftOptions].reduce((accumulator, option) => {
      if (!option.label) {
        return accumulator;
      }

      if (!accumulator.find((entry) => entry.value === option.value)) {
        accumulator.push(option);
      }

      return accumulator;
    }, []);
  }, [masters?.shifts]);

  const trendRows = useMemo(() => {
    const grouped = new Map();

    normalizedReports.forEach((report) => {
      const current = grouped.get(report.reportDateValue) || {
        reportDate: report.reportDateValue,
        reports: 0,
        labourCount: 0,
        machineCount: 0,
        blockedCount: 0,
      };

      current.reports += 1;
      current.labourCount += report.labourCount;
      current.machineCount += report.machineCount;
      current.blockedCount += report.reportStatus === "blocked" ? 1 : 0;
      grouped.set(report.reportDateValue, current);
    });

    const rows = Array.from(grouped.values()).sort((left, right) =>
      right.reportDate.localeCompare(left.reportDate)
    );
    const maxLabour = Math.max(...rows.map((row) => row.labourCount), 1);

    return rows.slice(0, 8).map((row) => ({
      ...row,
      labourWidth: `${Math.max((row.labourCount / maxLabour) * 100, row.labourCount ? 10 : 0)}%`,
    }));
  }, [normalizedReports]);

  const projectLeaderboard = useMemo(() => {
    const grouped = new Map();

    normalizedReports.forEach((report) => {
      const key = `${report.projectName || "Unknown Project"}__${report.siteName || "Unknown Site"}`;
      const current = grouped.get(key) || {
        projectName: report.projectName || "Unknown Project",
        siteName: report.siteName || "Unknown Site",
        reports: 0,
        labourCount: 0,
        machineCount: 0,
        latestDate: report.reportDateValue,
        averageProgressPercent: 0,
        progressSamples: 0,
      };

      current.reports += 1;
      current.labourCount += report.labourCount;
      current.machineCount += report.machineCount;

      if (report.progressPercent !== null && !Number.isNaN(report.progressPercent)) {
        current.averageProgressPercent += report.progressPercent;
        current.progressSamples += 1;
      }

      if (report.reportDateValue > current.latestDate) {
        current.latestDate = report.reportDateValue;
      }

      grouped.set(key, current);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        averageProgressPercent: item.progressSamples
          ? Number((item.averageProgressPercent / item.progressSamples).toFixed(1))
          : null,
      }))
      .sort((left, right) => {
        if (right.labourCount !== left.labourCount) {
          return right.labourCount - left.labourCount;
        }

        if (right.reports !== left.reports) {
          return right.reports - left.reports;
        }

        return right.latestDate.localeCompare(left.latestDate);
      })
      .slice(0, 5);
  }, [normalizedReports]);

  const attentionItems = useMemo(() => {
    return normalizedReports
      .map((report) => {
        const flags = [];

        if (report.reportStatus === "blocked") {
          flags.push("Blocked execution");
        }

        if (!report.materialUsed) {
          flags.push("Material usage not captured");
        }

        if (!report.nextPlan) {
          flags.push("Next plan missing");
        }

        if (report.progressPercent !== null && report.progressPercent < 30) {
          flags.push("Low progress capture");
        }

        if (report.labourCount === 0 && report.machineCount === 0) {
          flags.push("No labour or machine deployment recorded");
        }

        return {
          id: report.id,
          projectName: report.projectName,
          siteName: report.siteName,
          reportDateValue: report.reportDateValue,
          workDone: report.workDone,
          flags,
        };
      })
      .filter((item) => item.flags.length > 0)
      .slice(0, 6);
  }, [normalizedReports]);

  const toggleSection = (sectionKey) => {
    setSectionVisibility((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setEditingReportId(null);
  };

  const handleEditReport = (report) => {
    setFormData({
      reportDate: report.reportDateValue || todayDate,
      plantId: report.plantId ? String(report.plantId) : "",
      projectName: report.projectName || "",
      siteName: report.siteName || "",
      shift: report.shift || "general",
      weather: report.weather || "",
      reportStatus: report.reportStatus || "on_track",
      progressPercent:
        report.progressPercent === null || report.progressPercent === undefined
          ? ""
          : String(report.progressPercent),
      workDone: report.workDone || "",
      labourCount: String(report.labourCount ?? ""),
      machineCount: String(report.machineCount ?? ""),
      materialUsed: report.materialUsed || "",
      blockers: report.blockers || "",
      nextPlan: report.nextPlan || "",
      remarks: report.remarks || "",
    });
    setEditingReportId(report.id);
    setExpandedReportId(report.id);
    setSectionVisibility((current) => ({
      ...current,
      form: true,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteReport = async (report) => {
    const confirmed = window.confirm(
      `Delete the report for ${report.projectName} on ${formatDisplayDate(report.reportDateValue)}?`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.delete(`/project-reports/${report.id}`);
      setSuccess("Project report deleted successfully");

      if (editingReportId === report.id) {
        resetForm();
      }

      await loadReports({
        search: deferredSearch,
        plantId: plantFilter,
        projectName: projectFilter,
        siteName: siteFilter,
        reportStatus: reportStatusFilter,
        startDate,
        endDate,
        page,
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete project report");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload = {
      reportDate: formData.reportDate,
      plantId: Number(formData.plantId),
      projectName: String(formData.projectName || "").trim(),
      siteName: String(formData.siteName || "").trim(),
      shift: String(formData.shift || "").trim(),
      weather: String(formData.weather || "").trim(),
      reportStatus: String(formData.reportStatus || "").trim(),
      progressPercent:
        formData.progressPercent === "" ? "" : Number(formData.progressPercent),
      workDone: String(formData.workDone || "").trim(),
      labourCount: Number(formData.labourCount),
      machineCount: Number(formData.machineCount),
      materialUsed: String(formData.materialUsed || "").trim(),
      blockers: String(formData.blockers || "").trim(),
      nextPlan: String(formData.nextPlan || "").trim(),
      remarks: String(formData.remarks || "").trim(),
    };

    if (
      !payload.reportDate ||
      !formData.plantId ||
      !payload.projectName ||
      !payload.siteName ||
      !payload.workDone ||
      formData.labourCount === "" ||
      formData.machineCount === ""
    ) {
      setError("Date, plant, project, site, work done, labour count, and machine count are required");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.reportDate)) {
      setError("Report date must use YYYY-MM-DD format");
      return;
    }

    if (payload.labourCount < 0 || payload.machineCount < 0) {
      setError("Labour count and machine count cannot be negative");
      return;
    }

    if (
      payload.progressPercent !== "" &&
      (Number(payload.progressPercent) < 0 || Number(payload.progressPercent) > 100)
    ) {
      setError("Progress percent must be between 0 and 100");
      return;
    }

    setLoading(true);

    try {
      if (editingReportId) {
        await api.put(`/project-reports/${editingReportId}`, payload);
        setSuccess("Project report updated successfully");
      } else {
        await api.post("/project-reports", payload);
        setSuccess("Project report added successfully");
      }

      resetForm();
      await loadReports({
        search: deferredSearch,
        plantId: plantFilter,
        projectName: projectFilter,
        siteName: siteFilter,
        reportStatus: reportStatusFilter,
        startDate,
        endDate,
        page,
      });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          (editingReportId ? "Failed to update project report" : "Failed to add project report")
      );
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setPlantFilter("");
    setProjectFilter("");
    setSiteFilter("");
    setReportStatusFilter("");
    setStartDate("");
    setEndDate("");
    setActiveWindow("All Time");
    setPage(1);
  };

  const applyDateWindow = (range) => {
    setActiveWindow(range.label);
    setPage(1);

    if (range.days === null) {
      setStartDate("");
      setEndDate("");
      return;
    }

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - range.days);
    setStartDate(toDateOnlyValue(start));
    setEndDate(toDateOnlyValue(end));
  };

  const handleExportCsv = () => {
    const rows = normalizedReports.map((report) => ({
      report_date: report.reportDateValue,
      plant_name: report.plantName || "",
      project_name: report.projectName || "",
      site_name: report.siteName || "",
      shift: report.shift || "",
      weather: report.weather || "",
      report_status: formatReportStatusLabel(report.reportStatus),
      progress_percent: report.progressPercent ?? "",
      work_done: report.workDone || "",
      labour_count: report.labourCount,
      machine_count: report.machineCount,
      labour_per_machine: getLabourPerMachine(report.labourCount, report.machineCount),
      material_used: report.materialUsed || "",
      blockers: report.blockers || "",
      next_plan: report.nextPlan || "",
      remarks: report.remarks || "",
    }));

    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `project-reports-${getTimestampFileLabel()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="Project Reports"
      subtitle="Daily project execution reporting with cleaner oversight, richer field capture, and safer correction workflows"
    >
      <div style={styles.stack}>
        <div style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.heroContent}>
            <div style={styles.heroCopy}>
              <p style={styles.heroEyebrow}>Execution Intelligence Layer</p>
              <h1 style={styles.heroTitle}>Project Reporting That Handles Real Operations</h1>
              <p style={styles.heroText}>
                Capture the daily site picture with status, progress, blockers, next steps, and
                practical correction controls. The workspace is designed so teams can report,
                review, and fix entries without turning the page into noise.
              </p>
            </div>

            <div style={styles.heroSignalGrid}>
              <SignalPill
                label="Latest Reporting Date"
                value={serverSummary.latestDate ? formatDisplayDate(serverSummary.latestDate) : "-"}
              />
              <SignalPill
                label="Top Project by Labour"
                value={serverSummary.topProjectName || "No data yet"}
              />
              <SignalPill
                label="Average Labour / Report"
                value={formatCompactNumber(serverSummary.averageLabourPerReport)}
              />
            </div>
          </div>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {mastersError ? <div style={styles.error}>{mastersError}</div> : null}

        <SectionCard title="Portfolio Snapshot">
          <SectionToolbar
            visible={sectionVisibility.snapshot}
            onToggle={() => toggleSection("snapshot")}
          />
          {sectionVisibility.snapshot ? (
            <>
              <div style={styles.summaryGrid}>
                <MetricCard
                  tone="blue"
                  tag="Reports"
                  label="Entries in Scope"
                  value={serverSummary.total}
                  detail={`${pagination.total} shown in the current page lens`}
                />
                <MetricCard
                  tone="green"
                  tag="Projects"
                  label="Active Projects"
                  value={serverSummary.uniqueProjects}
                  detail={`${serverSummary.uniqueSites} active sites`}
                />
                <MetricCard
                  tone="amber"
                  tag="Labour"
                  label="Workforce Deployed"
                  value={serverSummary.totalLabour}
                  detail={`${formatCompactNumber(serverSummary.averageLabourPerReport)} avg per report`}
                />
                <MetricCard
                  tone="rose"
                  tag="Machines"
                  label="Machine Deployment"
                  value={serverSummary.totalMachines}
                  detail={`${formatCompactNumber(serverSummary.averageMachinesPerReport)} avg per report`}
                />
              </div>

              <div style={styles.insightRibbon}>
                <InsightStat
                  label="Reporting Coverage"
                  value={`${serverSummary.materialCoverage}%`}
                  note="entries with material usage captured"
                />
                <InsightStat
                  label="Remark Discipline"
                  value={`${serverSummary.remarksCoverage}%`}
                  note="entries with closing remarks"
                />
                <InsightStat
                  label="Resource Intensity"
                  value={formatCompactNumber(serverSummary.labourPerMachine)}
                  note="labour per machine in this filtered dataset"
                />
                <InsightStat
                  label="Most Recent Activity"
                  value={serverSummary.latestDate ? formatDisplayDate(serverSummary.latestDate) : "-"}
                  note="latest report included in the current lens"
                />
              </div>
            </>
          ) : (
            <CollapsedNote text="Snapshot cards are hidden to keep the page compact." />
          )}
        </SectionCard>

        <SectionCard title="Analysis Controls">
          <SectionToolbar
            visible={sectionVisibility.controls}
            onToggle={() => toggleSection("controls")}
          />
          {sectionVisibility.controls ? (
            <>
              <p style={styles.sectionSubtitle}>
                Combine date range, plant, project, site, status, and search to narrow the report
                stream to a practical working set. The current filter state stays in the URL so
                this view can be refreshed or shared without losing context.
              </p>

              <div style={styles.chipRow}>
                {DATE_RANGES.map((range) => (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => applyDateWindow(range)}
                    style={{
                      ...styles.filterChip,
                      ...(activeWindow === range.label ? styles.filterChipActive : {}),
                    }}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              <div style={styles.filterGrid}>
                <input
                  placeholder="Search project, site, work done, blockers, next plan, or remarks"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  style={styles.input}
                />

                <select
                  value={plantFilter}
                  onChange={(event) => {
                    setPlantFilter(event.target.value);
                    setPage(1);
                  }}
                  style={styles.input}
                >
                  <option value="">All Plants / Units</option>
                  {reportPlantOptions.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.plantName}
                      {plant.plantType ? ` • ${plant.plantType}` : ""}
                      {!plant.isActive ? " • Inactive" : ""}
                    </option>
                  ))}
                </select>

                <select
                  value={projectFilter}
                  onChange={(event) => {
                    setProjectFilter(event.target.value);
                    setPage(1);
                  }}
                  style={styles.input}
                >
                  <option value="">All Projects</option>
                  {(lookups.projectNames || []).map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>

                <select
                  value={siteFilter}
                  onChange={(event) => {
                    setSiteFilter(event.target.value);
                    setPage(1);
                  }}
                  style={styles.input}
                >
                  <option value="">All Sites</option>
                  {(lookups.siteNames || []).map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>

                <select
                  value={reportStatusFilter}
                  onChange={(event) => {
                    setReportStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  style={styles.input}
                >
                  <option value="">All Statuses</option>
                  {reportStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setActiveWindow("Custom");
                    setPage(1);
                  }}
                  style={styles.input}
                />

                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setActiveWindow("Custom");
                    setPage(1);
                  }}
                  style={styles.input}
                />

                <div style={styles.buttonRow}>
                  <button type="button" style={styles.secondaryButton} onClick={clearFilters}>
                    Reset View
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={handleExportCsv}
                    disabled={!normalizedReports.length || loadingReports}
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </>
          ) : (
            <CollapsedNote text="Filters are hidden. Use Show when you need to change the analysis lens." />
          )}
        </SectionCard>

        <SectionCard title="Execution Insights">
          <SectionToolbar
            visible={sectionVisibility.analytics}
            onToggle={() => toggleSection("analytics")}
          />
          {sectionVisibility.analytics ? (
            <div style={styles.analyticsGrid}>
              <div style={styles.analyticsColumn}>
                <h4 style={styles.subsectionTitle}>Project Focus Board</h4>
                {projectLeaderboard.length === 0 ? (
                  <EmptyState
                    title="No project activity in this view"
                    text="Widen the date range or clear the filters to compare project momentum."
                  />
                ) : (
                  <div style={styles.focusStack}>
                    {projectLeaderboard.map((item, index) => (
                      <div key={`${item.projectName}-${item.siteName}`} style={styles.focusCard}>
                        <div style={styles.focusHeader}>
                          <span style={styles.focusRank}>#{index + 1}</span>
                          <div>
                            <h3 style={styles.focusTitle}>{item.projectName}</h3>
                            <p style={styles.focusSubtext}>{item.siteName}</p>
                          </div>
                        </div>

                        <div style={styles.focusMetrics}>
                          <span style={styles.focusMetric}>{item.reports} reports</span>
                          <span style={styles.focusMetric}>{item.labourCount} labour</span>
                          <span style={styles.focusMetric}>{item.machineCount} machines</span>
                          <span style={styles.focusMetric}>
                            Avg progress {item.averageProgressPercent ?? "-"}%
                          </span>
                        </div>

                        <p style={styles.focusNote}>
                          Latest activity: {formatDisplayDate(item.latestDate)}. Labour per machine:{" "}
                          {getLabourPerMachine(item.labourCount, item.machineCount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.analyticsColumn}>
                <h4 style={styles.subsectionTitle}>Daily Trend</h4>
                {trendRows.length === 0 ? (
                  <EmptyState
                    title="No trend data yet"
                    text="Once reports exist in the current range, this view will summarize daily load."
                  />
                ) : (
                  <div style={styles.trendStack}>
                    {trendRows.map((row) => (
                      <div key={row.reportDate} style={styles.trendRow}>
                        <div style={styles.trendMeta}>
                          <strong style={styles.trendDate}>{formatDisplayDate(row.reportDate)}</strong>
                          <span style={styles.trendSubtext}>
                            {row.reports} reports, {row.machineCount} machines, {row.blockedCount} blocked
                          </span>
                        </div>

                        <div style={styles.trendBarShell}>
                          <div style={{ ...styles.trendBarFill, width: row.labourWidth }} />
                        </div>

                        <strong style={styles.trendValue}>{row.labourCount} labour</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <CollapsedNote text="Insights are hidden to keep the workspace focused on entry or review." />
          )}
        </SectionCard>

        <SectionCard title="Attention Queue">
          <SectionToolbar
            visible={sectionVisibility.attention}
            onToggle={() => toggleSection("attention")}
          />
          {sectionVisibility.attention ? (
            attentionItems.length === 0 ? (
              <EmptyState
                title="Reporting quality looks stable"
                text="No obvious gaps or blocked execution signals are present in the current lens."
              />
            ) : (
              <div style={styles.attentionGrid}>
                {attentionItems.map((item) => (
                  <div key={item.id} style={styles.attentionCard}>
                    <div style={styles.attentionHeader}>
                      <span style={styles.attentionDate}>{formatDisplayDate(item.reportDateValue)}</span>
                      <strong style={styles.attentionProject}>{item.projectName}</strong>
                    </div>
                    <p style={styles.attentionSite}>{item.siteName}</p>
                    <p style={styles.attentionWork}>{item.workDone}</p>
                    <div style={styles.flagRow}>
                      {item.flags.map((flag) => (
                        <span key={flag} style={styles.flag}>
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <CollapsedNote text="Attention cards are hidden. Show them when you want a quick quality check." />
          )}
        </SectionCard>

        <SectionCard title={editingReportId ? "Edit Project Report" : "Add Project Report"}>
          <SectionToolbar
            visible={sectionVisibility.form}
            onToggle={() => toggleSection("form")}
          />
          {sectionVisibility.form ? (
            <>
              <div style={styles.noteBox}>
                Use this form for disciplined daily execution reporting. Capture status, progress,
                blockers, and the next plan so management can review movement without guessing.
              </div>

              <div style={styles.advisoryGrid}>
                <div style={styles.advisoryCard}>
                  <span style={styles.advisoryEyebrow}>Required</span>
                  <strong style={styles.advisoryTitle}>Keep the site diary disciplined</strong>
                  <p style={styles.advisoryText}>
                    Date, plant, project, site, work done, labour, and machine count are the core
                    fields. The rest strengthens planning and review quality.
                  </p>
                </div>
                <div style={styles.advisoryCard}>
                  <span style={styles.advisoryEyebrow}>Practical</span>
                  <strong style={styles.advisoryTitle}>One clear update per site per day</strong>
                  <p style={styles.advisoryText}>
                    Record what moved, what blocked progress, and what happens next so this page
                    stays useful in daily review meetings and escalation calls.
                  </p>
                </div>
              </div>

              {selectedPlant ? (
                <div style={styles.noteBox}>
                  Reporting against <strong>{selectedPlant.plantName}</strong>.
                  {" "}Type: {selectedPlant.plantType || "Not set"}.
                  {!selectedPlant.isActive ? " Status: inactive in masters." : ""}
                </div>
              ) : null}

              {!reportPlantOptions.length ? (
                <div style={styles.readOnlyNotice}>
                  No active plants are available from masters yet. Add a plant/unit in masters
                  before creating project reports.
                </div>
              ) : null}

              {!canManageProjectReports ? (
                <div style={styles.readOnlyNotice}>
                  This role has read-only access to project reporting. You can analyze delivery
                  movement here, but only authorized execution roles can create or correct entries.
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={styles.formGrid}>
                  <label style={styles.field}>
                    <span style={styles.label}>Report Date</span>
                    <input
                      type="date"
                      name="reportDate"
                      value={formData.reportDate}
                      onChange={handleFieldChange}
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Plant / Unit</span>
                    <select
                      name="plantId"
                      value={formData.plantId}
                      onChange={handleFieldChange}
                      style={styles.input}
                    >
                      <option value="">Select Plant / Unit</option>
                      {reportPlantOptions.map((plant) => (
                        <option key={plant.id} value={plant.id}>
                          {plant.plantName}
                          {plant.plantType ? ` • ${plant.plantType}` : ""}
                          {!plant.isActive ? " • Inactive" : ""}
                        </option>
                      ))}
                    </select>
                    <span style={styles.inputHint}>
                      Ex: choose the supplying or executing plant/unit linked to this site update.
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Project Name</span>
                    <input
                      name="projectName"
                      list="project-name-suggestions"
                      placeholder="Ex: Riverfront Bridge Package A"
                      value={formData.projectName}
                      onChange={handleFieldChange}
                      style={styles.input}
                    />
                    <span style={styles.inputHint}>
                      Use the same project name the team already uses in approvals, billing, and meetings.
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Site Name</span>
                    <input
                      name="siteName"
                      list="site-name-suggestions"
                      placeholder="Ex: Pier Zone 2"
                      value={formData.siteName}
                      onChange={handleFieldChange}
                      style={styles.input}
                    />
                    <span style={styles.inputHint}>
                      Use the workfront, zone, package, or location label supervisors use on site.
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Shift</span>
                    <select
                      name="shift"
                      value={formData.shift}
                      onChange={handleFieldChange}
                      style={styles.input}
                      disabled={loadingMasters}
                    >
                      {shiftOptions.map((option) => (
                        <option key={option.value || "empty"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span style={styles.inputHint}>
                      Shift options stay aligned with masters when your company configures them there.
                    </span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Weather</span>
                    <select
                      name="weather"
                      value={formData.weather}
                      onChange={handleFieldChange}
                      style={styles.input}
                    >
                      {WEATHER_OPTIONS.map((option) => (
                        <option key={option.value || "empty"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Status</span>
                    <select
                      name="reportStatus"
                      value={formData.reportStatus}
                      onChange={handleFieldChange}
                      style={styles.input}
                    >
                      {REPORT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Progress Percent</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      name="progressPercent"
                      placeholder="Ex: 48"
                      value={formData.progressPercent}
                      onChange={handleFieldChange}
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Labour Count</span>
                    <input
                      type="number"
                      min="0"
                      name="labourCount"
                      placeholder="Ex: 42"
                      value={formData.labourCount}
                      onChange={handleFieldChange}
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Machine Count</span>
                    <input
                      type="number"
                      min="0"
                      name="machineCount"
                      placeholder="Ex: 4"
                      value={formData.machineCount}
                      onChange={handleFieldChange}
                      style={styles.input}
                    />
                  </label>

                  <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                    <span style={styles.label}>Work Done</span>
                    <textarea
                      name="workDone"
                      placeholder="Ex: Reinforcement fixed for pier cap, shuttering completed, concreting prepared for tomorrow"
                      value={formData.workDone}
                      onChange={handleFieldChange}
                      style={{ ...styles.input, ...styles.textarea }}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Material Used</span>
                    <input
                      name="materialUsed"
                      placeholder="Ex: M20 concrete, TMT steel, shuttering oil"
                      value={formData.materialUsed}
                      onChange={handleFieldChange}
                      style={styles.input}
                    />
                  </label>

                  <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                    <span style={styles.label}>Blockers</span>
                    <textarea
                      name="blockers"
                      placeholder="Ex: Steel delivery pending, inspection hold, rain interruption in afternoon"
                      value={formData.blockers}
                      onChange={handleFieldChange}
                      style={{ ...styles.input, ...styles.textareaCompact }}
                    />
                  </label>

                  <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                    <span style={styles.label}>Next Plan</span>
                    <textarea
                      name="nextPlan"
                      placeholder="Ex: Start footing concrete at 8 AM after morning line check and cube preparation"
                      value={formData.nextPlan}
                      onChange={handleFieldChange}
                      style={{ ...styles.input, ...styles.textareaCompact }}
                    />
                  </label>

                  <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                    <span style={styles.label}>Remarks</span>
                    <textarea
                      name="remarks"
                      placeholder="Ex: Client walkthrough completed, safety briefing done, no NCR raised"
                      value={formData.remarks}
                      onChange={handleFieldChange}
                      style={{ ...styles.input, ...styles.textareaCompact }}
                    />
                  </label>

                  <div style={styles.buttonRow}>
                    <button
                      type="submit"
                      style={styles.button}
                      disabled={loading || !reportPlantOptions.length}
                    >
                      {loading
                        ? editingReportId
                          ? "Updating..."
                          : "Saving..."
                        : editingReportId
                          ? "Update Project Report"
                          : "Add Project Report"}
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={resetForm}
                      disabled={loading}
                    >
                      {editingReportId ? "Cancel Edit" : "Reset Form"}
                    </button>
                  </div>

                  <datalist id="project-name-suggestions">
                    {(lookups.projectNames || []).map((project) => (
                      <option key={project} value={project} />
                    ))}
                  </datalist>

                  <datalist id="site-name-suggestions">
                    {(lookups.siteNames || []).map((site) => (
                      <option key={site} value={site} />
                    ))}
                  </datalist>
                </form>
              )}
            </>
          ) : (
            <CollapsedNote text="The form is hidden. Show it when you need to add or correct a report." />
          )}
        </SectionCard>

        <SectionCard title="Project Daily Reports">
          <SectionToolbar
            visible={sectionVisibility.reports}
            onToggle={() => toggleSection("reports")}
          />
          {sectionVisibility.reports ? (
            loadingReports ? (
              <EmptyState
                title="Refreshing project reports"
                text="The reporting workspace is loading the latest filtered project activity."
              />
            ) : normalizedReports.length === 0 ? (
              <EmptyState
                title="No project reports match this analysis view"
                text="Clear filters, widen the date range, or add a new site update to keep this reporting layer useful."
              />
            ) : (
              <div style={styles.reportSection}>
                <div style={styles.paginationRow}>
                  <span style={styles.paginationText}>
                    Page {pagination.page} of {Math.max(pagination.totalPages || 1, 1)} •{" "}
                    {pagination.total} matching reports
                  </span>
                  <div style={styles.buttonRow}>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => setPage((current) => Math.max(current - 1, 1))}
                      disabled={!pagination.hasPreviousPage || loadingReports}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() =>
                        setPage((current) =>
                          Math.min(current + 1, Math.max(pagination.totalPages || 1, 1))
                        )
                      }
                      disabled={!pagination.hasNextPage || loadingReports}
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Project / Site</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Progress</th>
                        <th style={styles.th}>Resources</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedReports.map((report) => {
                        const isExpanded = expandedReportId === report.id;

                        return (
                          <ProjectReportRow
                            key={report.id}
                            report={report}
                            isExpanded={isExpanded}
                            canManage={canManageProjectReports}
                            onToggleExpand={() =>
                              setExpandedReportId((current) =>
                                current === report.id ? null : report.id
                              )
                            }
                            onEdit={() => handleEditReport(report)}
                            onDelete={() => handleDeleteReport(report)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            <CollapsedNote text="The report table is hidden. Show it when you want to review entries." />
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}

function ProjectReportRow({
  report,
  isExpanded,
  canManage,
  onToggleExpand,
  onEdit,
  onDelete,
}) {
  return (
    <>
      <tr>
        <td style={styles.td}>{formatDisplayDate(report.reportDateValue)}</td>
        <td style={styles.td}>
          <div style={styles.tableStack}>
            <strong>{report.projectName}</strong>
            <span style={styles.mutedText}>
              {(report.plantName || "Plant not linked")} • {report.siteName}
              {report.shift ? ` • ${formatTitleCase(report.shift)}` : ""}
            </span>
          </div>
        </td>
        <td style={styles.td}>
          <span
            style={{
              ...styles.statusBadge,
              ...(styles[`status${normalizeStatusStyleKey(report.reportStatus)}`] || {}),
            }}
          >
            {formatReportStatusLabel(report.reportStatus)}
          </span>
        </td>
        <td style={styles.td}>
          <div style={styles.tableStack}>
            <strong>{report.progressPercent ?? "-"}{report.progressPercent !== null ? "%" : ""}</strong>
            <span style={styles.mutedText}>{report.weather ? formatTitleCase(report.weather) : "Weather -"}</span>
          </div>
        </td>
        <td style={styles.td}>
          <div style={styles.tableStack}>
            <strong>
              {report.labourCount} labour / {report.machineCount} machines
            </strong>
            <span style={styles.mutedText}>
              {getLabourPerMachine(report.labourCount, report.machineCount)}
            </span>
          </div>
        </td>
        <td style={styles.td}>
          <div style={styles.rowActionGroup}>
            <button type="button" style={styles.smallButton} onClick={onToggleExpand}>
              {isExpanded ? "Less" : "More"}
            </button>
            {canManage ? (
              <>
                <button type="button" style={styles.smallButton} onClick={onEdit}>
                  Edit
                </button>
                <button type="button" style={styles.smallButtonDanger} onClick={onDelete}>
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </td>
      </tr>
      {isExpanded ? (
        <tr>
          <td colSpan={6} style={styles.expandedCell}>
            <div style={styles.expandedGrid}>
              <DetailCard label="Plant / Unit" value={report.plantName || "-"} />
              <DetailCard label="Work Done" value={report.workDone} />
              <DetailCard label="Material Used" value={report.materialUsed || "-"} />
              <DetailCard label="Blockers" value={report.blockers || "-"} />
              <DetailCard label="Next Plan" value={report.nextPlan || "-"} />
              <DetailCard label="Remarks" value={report.remarks || "-"} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DetailCard({ label, value }) {
  return (
    <div style={styles.detailCard}>
      <span style={styles.detailLabel}>{label}</span>
      <p style={styles.detailValue}>{value}</p>
    </div>
  );
}

function SectionToolbar({ visible, onToggle }) {
  return (
    <div style={styles.sectionToolbar}>
      <button type="button" style={styles.toggleButton} onClick={onToggle}>
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function CollapsedNote({ text }) {
  return <div style={styles.collapsedNote}>{text}</div>;
}

function SignalPill({ label, value }) {
  return (
    <div style={styles.heroPill}>
      <span style={styles.heroPillLabel}>{label}</span>
      <strong style={styles.heroPillValue}>{value}</strong>
    </div>
  );
}

function MetricCard({ tone, tag, label, value, detail }) {
  return (
    <div style={{ ...styles.summaryCard, ...(styles[`summary${tone}`] || {}) }}>
      <span style={styles.summaryTag}>{tag}</span>
      <p style={styles.summaryLabel}>{label}</p>
      <h3 style={styles.summaryValue}>{value}</h3>
      <p style={styles.summaryDetail}>{detail}</p>
    </div>
  );
}

function InsightStat({ label, value, note }) {
  return (
    <div style={styles.insightCard}>
      <span style={styles.insightLabel}>{label}</span>
      <strong style={styles.insightValue}>{value}</strong>
      <p style={styles.insightNote}>{note}</p>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div style={styles.emptyState}>
      <strong style={styles.emptyStateTitle}>{title}</strong>
      <p style={styles.emptyStateText}>{text}</p>
    </div>
  );
}

const buildSummary = (reports) => {
  const total = reports.length;
  const totalLabour = reports.reduce((sum, report) => sum + Number(report.labourCount || 0), 0);
  const totalMachines = reports.reduce((sum, report) => sum + Number(report.machineCount || 0), 0);
  const uniqueProjects = new Set(reports.map((report) => report.projectName).filter(Boolean)).size;
  const uniqueSites = new Set(reports.map((report) => report.siteName).filter(Boolean)).size;
  const latestDate = reports.reduce(
    (current, report) => (report.reportDateValue > current ? report.reportDateValue : current),
    ""
  );
  const projectLabourMap = new Map();

  reports.forEach((report) => {
    const key = report.projectName || "Unknown Project";
    projectLabourMap.set(key, (projectLabourMap.get(key) || 0) + Number(report.labourCount || 0));
  });

  const topProject = Array.from(projectLabourMap.entries()).sort((left, right) => right[1] - left[1])[0];

  return {
    total,
    totalLabour,
    totalMachines,
    uniqueProjects,
    uniqueSites,
    latestDate,
    averageLabourPerReport: total ? totalLabour / total : 0,
    averageMachinesPerReport: total ? totalMachines / total : 0,
    labourPerMachine: totalMachines ? totalLabour / totalMachines : 0,
    materialCoverage: total
      ? Math.round(
          (reports.filter((report) => String(report.materialUsed || "").trim()).length / total) * 100
        )
      : 0,
    remarksCoverage: total
      ? Math.round(
          (reports.filter((report) => String(report.remarks || "").trim()).length / total) * 100
        )
      : 0,
    topProjectName: topProject?.[0] || "",
  };
};

const formatCompactNumber = (value) => {
  const normalized = Number(value || 0);

  if (!Number.isFinite(normalized)) {
    return "0";
  }

  return normalized % 1 === 0 ? String(normalized) : normalized.toFixed(1);
};

const getLabourPerMachine = (labourCount, machineCount) => {
  if (!Number(machineCount)) {
    return Number(labourCount) ? "Manual / no machines" : "-";
  }

  return `${formatCompactNumber(Number(labourCount || 0) / Number(machineCount))} labour / machine`;
};

const formatTitleCase = (value) =>
  String(value || "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatReportStatusLabel = (value) => {
  if (!value) {
    return "Not Set";
  }

  return formatTitleCase(value);
};

const normalizeStatusStyleKey = (value) => {
  if (!value) {
    return "neutral";
  }

  return String(value).replace(/[^a-zA-Z0-9]/g, "");
};

const escapeCsvValue = (value) => {
  const normalizedValue = String(value ?? "");

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
};

const buildCsv = (rows) => {
  if (!rows.length) {
    return "report_date,project_name,site_name,shift,weather,report_status,progress_percent,work_done,labour_count,machine_count,labour_per_machine,material_used,blockers,next_plan,remarks\n";
  }

  const headers = Object.keys(rows[0]);

  return `${[
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\n")}\n`;
};

const parseProjectReportQuery = (searchValue) => {
  const params = new URLSearchParams(searchValue);
  const startDate = params.get("startDate") || "";
  const endDate = params.get("endDate") || "";

  return {
    search: params.get("search") || "",
    plantFilter: params.get("plantId") || "",
    projectFilter: params.get("projectName") || "",
    siteFilter: params.get("siteName") || "",
    reportStatusFilter: params.get("reportStatus") || "",
    startDate,
    endDate,
    activeWindow: params.get("window") || (startDate || endDate ? "Custom" : "All Time"),
    page: Math.max(Number(params.get("page")) || 1, 1),
  };
};

const buildProjectReportQueryString = ({
  search = "",
  plantFilter = "",
  projectFilter = "",
  siteFilter = "",
  reportStatusFilter = "",
  startDate = "",
  endDate = "",
  activeWindow = "All Time",
  page = 1,
}) => {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }

  if (plantFilter) {
    params.set("plantId", plantFilter);
  }

  if (projectFilter) {
    params.set("projectName", projectFilter);
  }

  if (siteFilter) {
    params.set("siteName", siteFilter);
  }

  if (reportStatusFilter) {
    params.set("reportStatus", reportStatusFilter);
  }

  if (startDate) {
    params.set("startDate", startDate);
  }

  if (endDate) {
    params.set("endDate", endDate);
  }

  if (activeWindow && activeWindow !== "All Time") {
    params.set("window", activeWindow);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  return params.toString();
};

const styles = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "30px",
    padding: "30px",
    background:
      "radial-gradient(circle at top left, rgba(214,180,121,0.16), transparent 24%), radial-gradient(circle at bottom right, rgba(148,163,184,0.14), transparent 30%), linear-gradient(135deg, #111827 0%, #172033 46%, #1f2937 100%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 28px 72px rgba(15,23,42,0.18)",
  },
  heroGlowOne: {
    position: "absolute",
    top: "-90px",
    right: "-60px",
    width: "240px",
    height: "240px",
    borderRadius: "999px",
    background: "rgba(214,180,121,0.16)",
    filter: "blur(42px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: "-120px",
    left: "-40px",
    width: "260px",
    height: "260px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.14)",
    filter: "blur(46px)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, 1fr)",
    gap: "22px",
    alignItems: "center",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  heroEyebrow: {
    margin: 0,
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    letterSpacing: "0.14em",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1.02,
    fontWeight: "800",
    letterSpacing: "-0.05em",
    maxWidth: "760px",
  },
  heroText: {
    margin: 0,
    maxWidth: "720px",
    color: "rgba(255,255,255,0.84)",
    lineHeight: 1.85,
    fontSize: "15px",
  },
  heroSignalGrid: {
    display: "grid",
    gap: "12px",
  },
  heroPill: {
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px",
    padding: "16px",
    backdropFilter: "blur(10px)",
  },
  heroPillLabel: {
    display: "block",
    marginBottom: "6px",
    fontSize: "11px",
    fontWeight: "800",
    color: "rgba(255,255,255,0.68)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  heroPillValue: {
    fontSize: "16px",
    color: "#ffffff",
    lineHeight: 1.35,
  },
  error: {
    color: "#b91c1c",
    background: "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)",
    border: "1px solid #fecaca",
    borderRadius: "16px",
    padding: "13px 16px",
  },
  success: {
    color: "#0f5132",
    background: "linear-gradient(135deg, #f3faf7 0%, #edf7f2 100%)",
    border: "1px solid #c7e6d6",
    borderRadius: "16px",
    padding: "13px 16px",
  },
  sectionToolbar: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "10px",
  },
  toggleButton: {
    border: "1px solid #d1d5db",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    color: "#111827",
    fontWeight: "700",
    fontSize: "12px",
    padding: "8px 13px",
    cursor: "pointer",
  },
  collapsedNote: {
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "14px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  summaryCard: {
    borderRadius: "24px",
    padding: "22px",
    border: "1px solid rgba(255,255,255,0.4)",
    boxShadow: "0 16px 36px rgba(15,23,42,0.05)",
  },
  summaryblue: {
    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
  },
  summarygreen: {
    background: "linear-gradient(135deg, #f7f7f2 0%, #f3f4ee 100%)",
  },
  summaryamber: {
    background: "linear-gradient(135deg, #faf7f2 0%, #f6f1e8 100%)",
  },
  summaryrose: {
    background: "linear-gradient(135deg, #f7f4f3 0%, #f1eeec 100%)",
  },
  summaryTag: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.82)",
    color: "#1f2937",
    fontSize: "11px",
    fontWeight: "800",
    marginBottom: "12px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
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
    fontSize: "34px",
    lineHeight: 1.05,
    fontWeight: "800",
  },
  summaryDetail: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  insightRibbon: {
    marginTop: "18px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  insightCard: {
    borderRadius: "20px",
    padding: "18px",
    background: "linear-gradient(180deg, #fcfcfb 0%, #ffffff 100%)",
    border: "1px solid #e7e5e4",
  },
  insightLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  insightValue: {
    display: "block",
    color: "#111827",
    fontSize: "24px",
    lineHeight: 1.15,
    fontWeight: "800",
  },
  insightNote: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  sectionSubtitle: {
    margin: "0 0 16px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.8,
    maxWidth: "860px",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
  },
  filterChip: {
    padding: "10px 14px",
    border: "1px solid #d6d3d1",
    borderRadius: "999px",
    background: "#fff",
    color: "#111827",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
  filterChipActive: {
    background: "#1f2937",
    color: "#fff",
    border: "1px solid #1f2937",
    boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "15px",
    alignItems: "start",
  },
  input: {
    padding: "13px 15px",
    border: "1px solid #d6d3d1",
    borderRadius: "16px",
    fontSize: "14px",
    outline: "none",
    background: "rgba(255,255,255,0.96)",
    width: "100%",
    boxSizing: "border-box",
    color: "#111827",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
  },
  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
  },
  analyticsColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  subsectionTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "16px",
    fontWeight: "800",
  },
  focusStack: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  focusCard: {
    borderRadius: "20px",
    padding: "20px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafb 100%)",
    border: "1px solid #e7e5e4",
  },
  focusHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  focusRank: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1f2937",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "800",
    flexShrink: 0,
  },
  focusTitle: {
    margin: 0,
    fontSize: "16px",
    color: "#111827",
    lineHeight: 1.3,
  },
  focusSubtext: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  focusMetrics: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  focusMetric: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#1f2937",
    fontSize: "12px",
    fontWeight: "700",
  },
  focusNote: {
    margin: "12px 0 0",
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  trendStack: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  trendRow: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 1fr) minmax(120px, 2fr) auto",
    gap: "14px",
    alignItems: "center",
  },
  trendMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  trendDate: {
    color: "#111827",
    fontSize: "14px",
  },
  trendSubtext: {
    color: "#64748b",
    fontSize: "12px",
  },
  trendBarShell: {
    width: "100%",
    height: "14px",
    borderRadius: "999px",
    background: "#e5e7eb",
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #334155 0%, #a16207 100%)",
  },
  trendValue: {
    color: "#111827",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  attentionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "14px",
  },
  attentionCard: {
    borderRadius: "20px",
    padding: "20px",
    background: "linear-gradient(180deg, #fbfaf8 0%, #ffffff 100%)",
    border: "1px solid #e7ded1",
  },
  attentionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  attentionDate: {
    color: "#8a6a3d",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  attentionProject: {
    color: "#111827",
    fontSize: "16px",
  },
  attentionSite: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  attentionWork: {
    margin: "10px 0 0",
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  flagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  },
  flag: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#fffdfa",
    border: "1px solid #e7ded1",
    color: "#7c5e36",
    fontSize: "12px",
    fontWeight: "700",
  },
  noteBox: {
    background: "linear-gradient(135deg, #f7f8fa 0%, #fbfbfc 100%)",
    color: "#334155",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid #dbe2ea",
    fontSize: "14px",
    marginBottom: "14px",
    lineHeight: 1.7,
  },
  readOnlyNotice: {
    background: "linear-gradient(135deg, #faf7f2 0%, #fcfbf8 100%)",
    color: "#7c5e36",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid #e7ded1",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  advisoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
    marginBottom: "14px",
  },
  advisoryCard: {
    borderRadius: "20px",
    padding: "18px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
  },
  advisoryEyebrow: {
    display: "block",
    marginBottom: "8px",
    color: "#8a6a2f",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  advisoryTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: "15px",
    lineHeight: 1.4,
    marginBottom: "6px",
  },
  advisoryText: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.65,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  inputHint: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.55,
  },
  textarea: {
    minHeight: "100px",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.6,
  },
  textareaCompact: {
    minHeight: "84px",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.6,
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  button: {
    padding: "13px 20px",
    border: "none",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #111827 0%, #273449 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "800",
    letterSpacing: "0.01em",
    boxShadow: "0 14px 28px rgba(15,23,42,0.12)",
  },
  secondaryButton: {
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.96)",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "700",
  },
  smallButton: {
    padding: "8px 11px",
    border: "1px solid #d1d5db",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.96)",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "12px",
  },
  smallButtonDanger: {
    padding: "8px 11px",
    border: "1px solid #fecaca",
    borderRadius: "999px",
    background: "#fcf2f1",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "12px",
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
  reportSection: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  paginationRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  paginationText: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "700",
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: "20px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    boxShadow: "0 14px 32px rgba(15,23,42,0.04)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "16px 14px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: "linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "16px 14px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
    fontSize: "14px",
    verticalAlign: "top",
  },
  tableStack: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  mutedText: {
    color: "#64748b",
    fontSize: "12px",
  },
  statusBadge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  statusontrack: {
    background: "#edf7f2",
    color: "#2f5d47",
  },
  statuswatch: {
    background: "#faf3e6",
    color: "#8a6a3d",
  },
  statusblocked: {
    background: "#f8ecea",
    color: "#8c3c36",
  },
  statuscompleted: {
    background: "#eef2f7",
    color: "#3f5268",
  },
  statusneutral: {
    background: "#eef1f4",
    color: "#475569",
  },
  rowActionGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  expandedCell: {
    padding: "0 14px 16px",
    background: "#fcfcfb",
    borderBottom: "1px solid #f1f5f9",
  },
  expandedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  detailCard: {
    borderRadius: "18px",
    padding: "16px",
    background: "linear-gradient(180deg, #ffffff 0%, #fbfbfa 100%)",
    border: "1px solid #e7e5e4",
  },
  detailLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  detailValue: {
    margin: 0,
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1.8,
    whiteSpace: "pre-wrap",
  },
};

export default ProjectReportsPage;
