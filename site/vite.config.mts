import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { visualizer } from "rollup-plugin-visualizer";
import path from "node:path";

const isDeploy = process.env.DEPLOY === "true";
const useHttps = process.env.HTTPS === "true";
const useStats = process.env.STATS === "true";

export default defineConfig({
  base: isDeploy ? "/smplr/" : "/",
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
    ...(useStats
      ? [
          visualizer({
            filename: "dist/stats.html",
            template: "treemap",
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      src: path.resolve(__dirname, "./src"),
    },
  },
  server: { port: 3001 },
});
