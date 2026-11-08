import { createTransactionManager } from "@solid-imager/db";
import { getExecutor } from "./executor";

export const DrizzleTransactionManager = createTransactionManager(getExecutor);
