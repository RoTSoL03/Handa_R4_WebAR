import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { networkInterfaces } from "node:os";

const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((address) => address?.family === "IPv4" && !address.internal)
  .map((address) => address.address);

export default defineConfig({
  plugins: [
    basicSsl({
      name: "Handa Pilipinas WebAR",
      domains: ["localhost", ...new Set(lanAddresses)],
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    // MindAR's production module already ships bundled with sibling chunks.
    // Let the browser load it directly instead of pre-bundling it with esbuild.
    exclude: ["mind-ar"],
  },
  build: {
    chunkSizeWarningLimit: 2600,
  },
});
