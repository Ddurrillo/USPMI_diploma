import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  server: {
    host: "::",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        ws: true,
      },
    },
    fs: {
      allow: ["./client", "index.html"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
  define: {
    __API_BASE__: JSON.stringify(process.env.VITE_API_BASE_URL || ""),
  },
});
