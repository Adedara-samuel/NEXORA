import { NexoraApiClient } from "@nexora/api-client";
import { useAuthStore } from "../store/auth-store";

export const apiClient = new NexoraApiClient({
  baseUrl: import.meta.env.VITE_CORE_API_URL ?? "http://localhost:4000",
  getAccessToken: () => useAuthStore.getState().accessToken,
});
