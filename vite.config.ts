import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  build: { license: { fileName: "THIRD-PARTY-LICENSES.md" } },
  plugins: [react(), tailwindcss()],
});
