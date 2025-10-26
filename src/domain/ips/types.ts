/**
 * IPs Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the data structure for an Intellectual Property (IP).
 * @property {string} name - The name of the IP.
 * @property {string} [description] - An optional description for the IP.
 */
export type IpData = {
  name: string;
  description?: string;
};
