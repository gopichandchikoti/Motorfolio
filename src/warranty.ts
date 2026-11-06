import { z } from 'zod';
import { amountSchema, dateSchema, idSchema, textSchema, attachmentSchema } from './contracts';
export const warrantySchema = z
  .object({
    id: idSchema,
    vehicleId: idSchema,
    title: textSchema,
    provider: textSchema,
    reference: z.string().max(200),
    startsOn: dateSchema,
    expiresOn: dateSchema.nullable(),
    expiresOdometer: amountSchema,
    leadDays: z.number().int().min(0).max(365),
    leadDistance: amountSchema,
    notes: z.string().max(2000),
    receipt: attachmentSchema.optional(),
    receiptName: z.string().max(200).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine((item) => !item.expiresOn || item.expiresOn >= item.startsOn, {
    path: ['expiresOn'],
    message: 'Coverage cannot end before it starts.',
  });
export type Warranty = z.infer<typeof warrantySchema>;
export function warrantyStatus(item: Warranty, current: number, date: string) {
  if (item.startsOn > date) return 'Not started';
  if ((item.expiresOn && item.expiresOn < date) || (item.expiresOdometer > 0 && current >= item.expiresOdometer))
    return 'Expired';
  if (!item.expiresOn && !item.expiresOdometer) return 'No expiry recorded';
  const days = item.expiresOn ? (Date.parse(item.expiresOn) - Date.parse(date)) / 86400000 : Infinity;
  if (days <= item.leadDays || (item.expiresOdometer > 0 && current + item.leadDistance >= item.expiresOdometer))
    return 'Expiring soon';
  return 'Active';
}
