import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  initialState,
  transition,
  type State,
  type Action,
  type Role,
} from './model';
import { DemoContext } from './context';

const KEY = 'kemi-pdf-demo-v2';
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.version === 2 &&
          Array.isArray(parsed.state?.campaigns) &&
          Array.isArray(parsed.state?.requests) &&
          Array.isArray(parsed.state?.notifications) &&
          Array.isArray(parsed.state?.packages) &&
          Array.isArray(parsed.state?.portfolios) &&
          Array.isArray(parsed.state?.operationRecords) &&
          parsed.state?.profile?.name &&
          parsed.state?.clientProfile?.name
        )
          return parsed.state as State;
      }
    } catch {
      /* Start a clean demo if storage is unavailable. */
    }
    return initialState();
  });
  const [role, updateRole] = useState<Role>(() => {
    try {
      const saved = sessionStorage.getItem('kemi-pdf-demo-role');
      if (saved && ['guest', 'client', 'creator', 'ops'].includes(saved))
        return saved as Role;
    } catch {
      /* Role selection still works in memory. */
    }
    return 'guest';
  });
  function setRole(next: Role) {
    updateRole(next);
    try {
      sessionStorage.setItem('kemi-pdf-demo-role', next);
    } catch {
      /* No real authentication data is stored. */
    }
  }
  const [storageError, setStorageError] = useState(false);
  function commit(next: State) {
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 2, state: next }));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  const act = (action: Action) => {
    try {
      commit(transition(state, action, role));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : '처리하지 못했어요. 다시 확인해 주세요.',
      );
      return false;
    }
  };
  return (
    <DemoContext
      value={{
        state,
        role,
        setRole,
        enter: (nextRole, name) => {
          setRole(nextRole);
          if (name?.trim()) {
            if (nextRole === 'creator')
              commit({
                ...state,
                profile: { ...state.profile, name: name.trim() },
              });
            else
              commit({
                ...state,
                clientProfile: { ...state.clientProfile, name: name.trim() },
              });
          }
        },
        act,
        storageError,
        reset: () => {
          commit(initialState());
          setRole('guest');
          toast.success('시연 데이터를 초기화했어요.');
        },
      }}
    >
      {children}
    </DemoContext>
  );
}
