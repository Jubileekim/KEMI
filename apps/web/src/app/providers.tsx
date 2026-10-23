import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "./query-client";
import { SessionContext } from "./session";
import type { Role } from "./routes";

export default function Providers({ children }: { children: ReactNode }) {
  const [role, updateRole] = useState<Role>("guest");
  function setRole(next: Role) {
    queryClient.cancelQueries();
    queryClient.clear();
    updateRole(next);
  }
  return (
    <QueryClientProvider client={queryClient}>
      <SessionContext value={{ role, setRole }}>{children}</SessionContext>
    </QueryClientProvider>
  );
}
