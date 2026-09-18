import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api/biomechanics": "http://127.0.0.1:8765" } },
  preview: { proxy: { "/api/biomechanics": "http://127.0.0.1:8765" } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("/node_modules/three/") ? "three" : undefined,
      },
    },
  },
});
