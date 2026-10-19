import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.API_PROXY_TARGET || "http://localhost:4000";
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Origin을 유지해 인증 API의 Origin 검사와 같은 조건으로 개발한다.
      proxy: { "/api": { target }, "/health": { target } },
    },
    preview: { port: 4173, strictPort: true },
  };
});
