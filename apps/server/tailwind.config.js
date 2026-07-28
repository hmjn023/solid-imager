import solidUiPreset from "../../packages/ui/tailwind.preset.js";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["variant", [".dark &", '[data-kb-theme="dark"] &']],
  presets: [solidUiPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../tauri/src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  prefix: "",
};
