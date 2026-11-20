import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Instance chosen at build time (see src/country.js): VITE_COUNTRY=de for the
// German instance, anything else = Polish (original behaviour).
const DE = process.env.VITE_COUNTRY === "de";

// <html lang> and <title> of the static shell (before React sets the language).
const countryHtml = {
  name: "country-html",
  transformIndexHtml(html) {
    if (!DE) return html;
    return html
      .replace('<html lang="pl">', '<html lang="de">')
      .replace(/<title>[^<]*<\/title>/, "<title>Rechtsradar · Monitoring von Rechtsänderungen</title>");
  },
};

export default defineConfig({
  plugins: [react(), countryHtml],
  base: "./",
  server: {
    port: Number(process.env.PORT) || 5173,
  },
});
