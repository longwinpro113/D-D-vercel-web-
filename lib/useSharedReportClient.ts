"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "report.sharedClient";
let sharedClientValue = "";
const listeners = new Set<(value: string) => void>();

const readStoredClient = () => {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return sharedClientValue || "";
  }
};

const setSharedClientValue = (nextClient: string) => {
  sharedClientValue = nextClient || "";
  try {
    if (sharedClientValue) window.localStorage.setItem(STORAGE_KEY, sharedClientValue);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
  listeners.forEach((listener) => listener(sharedClientValue));
};

export function useSharedReportClient() {
  const [client, setClient] = useState(readStoredClient);

  useEffect(() => {
    sharedClientValue = client || "";
  }, [client]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const nextClient = event.newValue || "";
      sharedClientValue = nextClient;
      setClient(nextClient);
      listeners.forEach((listener) => listener(nextClient));
    };

    const onSharedClientChange = (nextClient: string) => {
      setClient(nextClient || "");
    };

    window.addEventListener("storage", onStorage);
    listeners.add(onSharedClientChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      listeners.delete(onSharedClientChange);
    };
  }, []);

  const updateClient = useCallback((nextClient: string) => {
    setSharedClientValue(nextClient);
  }, []);

  return [client, updateClient] as const;
}
