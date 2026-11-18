import type { z } from "zod";
import type {
  menuDatasetSchema, menuProductSchema, menuComboSchema, menuComboItemSchema,
  menuVariantSchema, menuOptionSchema, menuOptionValueSchema,
  menuPriceSchema, menuAvailabilitySchema, menuProvenanceSchema,
} from "@/lib/validation/menu-data";

// Separate from legacy menu.ts: no storage or API migration is implied.
export type MenuDatasetV1 = z.infer<typeof menuDatasetSchema>;
export type MenuDataProduct = z.infer<typeof menuProductSchema>;
export type MenuDataCombo = z.infer<typeof menuComboSchema>;
export type MenuDataComboItem = z.infer<typeof menuComboItemSchema>;
export type MenuDataVariant = z.infer<typeof menuVariantSchema>;
export type MenuDataOption = z.infer<typeof menuOptionSchema>;
export type MenuDataOptionValue = z.infer<typeof menuOptionValueSchema>;
export type MenuDataPrice = z.infer<typeof menuPriceSchema>;
export type MenuDataAvailability = z.infer<typeof menuAvailabilitySchema>;
export type MenuDataProvenance = z.infer<typeof menuProvenanceSchema>;
