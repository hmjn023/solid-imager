import solidUiPreset from "@solid-imager/ui/tailwind-preset";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["variant", [".dark &", '[data-kb-theme="dark"] &']],
  presets: [solidUiPreset],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
};
