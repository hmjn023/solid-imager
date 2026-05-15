import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import { db } from "~/infrastructure/db/index";

export const DrizzleTransactionManager = createTransactionManager(db);
