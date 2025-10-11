/**
 * Class Name Utility for UI Components
 * Extracted from src/lib/utils.ts
 * Utility for merging Tailwind CSS classes
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
