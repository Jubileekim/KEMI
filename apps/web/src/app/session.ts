import { useSyncExternalStore } from "react";
import createSessionController from "../features/auth/session-controller";
import { authEnabled, mockEnabled } from "../features/auth/config";
import { connectSession } from "../shared/api/client";
import queryClient from "./query-client";

export { mockEnabled } from "../features/auth/config";
export const session = createSessionController(
  authEnabled,
  () => {
    queryClient.cancelQueries();
    queryClient.clear();
  },
  mockEnabled,
);
connectSession({
  token: session.getToken,
  recover: session.recover,
  epoch: session.epoch,
});
export function useSession() {
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  return { ...state, setRole: session.setMockRole };
}
