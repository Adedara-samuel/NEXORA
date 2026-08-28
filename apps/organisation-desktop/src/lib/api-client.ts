import { NexoraApiClient } from "@nexora/api-client";

export const apiClient = new NexoraApiClient({
  baseUrl: import.meta.env.VITE_CORE_API_URL ?? "http://localhost:4000",
  getAccessToken: () => null, // Organisation auth lands in Phase 4.
});
