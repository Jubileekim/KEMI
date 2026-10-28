// Read-only public-data preview. Production app/server configuration is unchanged.
import { defineConfig, mergeConfig } from "vite";
import type { IncomingMessage } from "node:http";
import webConfig from "../../apps/web/vite.config.ts";

export default defineConfig(async (env) => {
  const base =
    typeof webConfig === "function" ? await webConfig(env) : webConfig;
  return mergeConfig(base, {
    server: {
      proxy: {
        "/api": {
          target: "https://kemi-api.onrender.com",
          // Remote TLS requires the upstream Host/SNI; browser Origin stays intact.
          changeOrigin: true,
          // Only public catalog reads are needed for this preview.
          bypass(req: IncomingMessage) {
            const pathname = (req.url ?? "").split("?")[0];
            if (
              req.method !== "GET" ||
              !/^\/api\/(feed|projects|portfolios\/[1-9]\d*(\/media)?|creators\/[1-9]\d*|projects\/[1-9]\d*|packages\/[1-9]\d*|users\/[1-9]\d*\/reviews)$/.test(
                pathname ?? "",
              )
            )
              return false;
            return undefined;
          },
        },
      },
    },
  });
});
