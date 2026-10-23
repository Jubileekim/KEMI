import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "./query-client";
import { session } from "./session";

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    session.bootstrap();
    const verify = () => {
      if (document.visibilityState === "visible") session.verify();
    };
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", verify);
    return () => {
      window.removeEventListener("focus", verify);
      document.removeEventListener("visibilitychange", verify);
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
