"use client";

import { useEffect } from "react";
import { useSettings } from "@/stores/settings";
import { useWorkspace } from "@/stores/workspace";

/** Rehidrata los stores persistentes en el cliente (después del primer render). */
export function StoreHydrator() {
  useEffect(() => {
    useSettings.persist.rehydrate();
    useWorkspace.getState().hydrateWebSearch();
    useWorkspace.getState().loadCatalog();
  }, []);
  return null;
}
