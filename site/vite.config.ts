import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";

const isDeploy = process.env.DEPLOY === "true";
const useHttps = process.env.HTTPS === "true";

export default defineConfig({
  base: isDeploy ? "/smplr/" : "/",
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  resolve: {
    alias: {
      src: path.resolve(__dirname, "./src"),
    },
  },
  server: { port: 3001 },
});
