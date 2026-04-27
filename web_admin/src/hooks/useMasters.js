import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { getCachedResource } from "../services/clientCache";

const emptyMastersState = {
  crusherUnits: [],
  materials: [],
  shifts: [],
  vehicleTypes: [],
  configOptions: {
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

export function useMasters() {
  const [masters, setMasters] = useState(emptyMastersState);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [refreshingMasters, setRefreshingMasters] = useState(false);
  const [mastersError, setMastersError] = useState("");
  const [mastersLoadedAt, setMastersLoadedAt] = useState(null);
  const hasLoadedOnceRef = useRef(false);

  const loadMasters = useCallback(async () => {
    try {
      if (hasLoadedOnceRef.current) {
        setRefreshingMasters(true);
      } else {
        setLoadingMasters(true);
      }

      const data = await getCachedResource("masters:bundle", 60_000, async () => {
        const res = await api.get("/masters");
        return res.data.data || emptyMastersState;
      });
      setMasters(data);
      setMastersError("");
      setMastersLoadedAt(Date.now());
      hasLoadedOnceRef.current = true;
    } catch (error) {
      setMastersError(
        error?.response?.data?.message ||
          "Failed to load master data required for this screen"
      );
    } finally {
      setLoadingMasters(false);
      setRefreshingMasters(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadMasters();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMasters]);

  return {
    masters,
    loadingMasters,
    refreshingMasters,
    mastersError,
    mastersLoadedAt,
    hasMasters: Boolean(
      masters.crusherUnits.length ||
        masters.materials.length ||
        masters.shifts.length ||
        masters.vehicleTypes.length
    ),
    reloadMasters: loadMasters,
  };
}
