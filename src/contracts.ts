import { z } from 'zod';
export const idSchema = z.string().min(1).max(100);
export const textSchema = z.string().trim().min(1).max(200);
export const dateSchema = z.iso.date();
export const amountSchema = z.number().finite().min(0).max(1e9);
export const attachmentSchema = z
  .string()
  .max(4_100_000)
  .regex(/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/);
