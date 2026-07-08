import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://nazarkuznetsov.github.io",
  base: "/automaticDevelopment",
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
});

