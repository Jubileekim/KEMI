import { createContext, useContext } from 'react';
import type { State, Action, Role } from './model';
export type Demo = {
  state: State;
  role: Role;
  setRole: (r: Role) => void;
  enter: (role: 'client' | 'creator', name?: string) => void;
  act: (a: Action) => boolean;
  reset: () => void;
  storageError: boolean;
};
export const DemoContext = createContext<Demo | null>(null);
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider required');
  return value;
}
