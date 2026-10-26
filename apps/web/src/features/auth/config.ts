export const mockEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS === "true";
// Existing API contract can be exercised explicitly; D05 approval is still pending.
export const authEnabled =
  mockEnabled || import.meta.env.VITE_ENABLE_AUTH_API === "true";
