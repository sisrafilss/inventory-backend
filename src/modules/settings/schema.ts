import { z } from "zod";

export const updateStoreSettingSchema = z.object({
  body: z.object({
    storeName: z.string().min(1, "Store name is required").max(100).optional(),
    proprietor: z.string().max(100).optional(),
    phone: z.string().max(30).optional().nullable(),
    address: z.string().max(300).optional().nullable(),
    memoFooterNote: z.string().max(500).optional().nullable(),
  }),
});
