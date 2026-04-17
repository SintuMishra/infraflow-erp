import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";

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

      const res = await api.get("/masters");
      setMasters(res.data.data || emptyMastersState);
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
