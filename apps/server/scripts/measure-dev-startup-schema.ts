import { z } from "zod";

export const browserMeasurementSchema = z
  .object({
    staticReadyAtMs: z.number().nonnegative(),
    browserSetupAfterStaticReadyMs: z.number().nonnegative(),
    firstSsrHeadersAtMs: z.number().nonnegative(),
    firstSsrHtmlAtMs: z.number().nonnegative(),
    interactionReadyAtMs: z.number().nonnegative(),
    firstNavigationStartedAtMs: z.number().nonnegative(),
    firstRpcRequestAtMs: z.number().nonnegative(),
    firstRpcResponseAtMs: z.number().nonnegative(),
    browserErrors: z.array(z.string()),
    serverFailures: z.array(z.string()),
  })
  .strict();

export type BrowserMeasurement = z.infer<typeof browserMeasurementSchema>;
