import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:4319",
      "/rpc": {
        target: "http://127.0.0.1:8547",
        rewrite: (p) => p.replace(/^\/rpc/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: { react: ["react", "react-dom"], ethereum: ["viem"] },
      },
    },
  },
});
