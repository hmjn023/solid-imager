import solidUiPreset from "@solid-imager/ui/tailwind-preset";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["variant", [".dark &"]],
  presets: [solidUiPreset],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
};
