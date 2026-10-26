import { createContext, useContext } from 'react';
import type { Role } from './routes';
export const mockEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS === 'true';
export const SessionContext = createContext<{
  role: Role;
  setRole: (role: Role) => void;
}>({ role: 'guest', setRole: () => {} });
export const useSession = () => useContext(SessionContext);
