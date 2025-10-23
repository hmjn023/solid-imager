/**
 * IPs Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the data for an IP (Intellectual Property).
 */
export type IpData = {
  /**
   * The name of the IP.
   */
  name: string;
  /**
   * An optional description of the IP.
   */
  description?: string;
};
