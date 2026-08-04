import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/libris-study-tracker/",
  plugins: [react()],
  build: { sourcemap: true },
});
