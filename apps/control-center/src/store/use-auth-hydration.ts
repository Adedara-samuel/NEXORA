import { useEffect, useState } from "react";
import { useAuthStore } from "./auth-store";

/**
 * True once the persisted auth store has finished reading from localStorage.
 * Must default to false and only touch `useAuthStore.persist` inside an
 * effect — Next.js server-renders this client component once before
 * hydration, and `persist` isn't safe to call outside the browser.
 */
export function useAuthHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsubscribe;
  }, []);

  return hydrated;
}
