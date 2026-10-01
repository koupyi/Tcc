import { z } from 'zod';
import { normalizeCep, isValidCepFormat, isValidUF } from '../utils/cep';

/**
 * Custom CEP validation:
 * - Accepts both 00000-000 and 00000000 formats
 * - Normalizes to 8-digit canonical form
 * - Validates exactly 8 digits
 */
const cepSchema = z.string()
  .trim()
  .transform((val) => normalizeCep(val))
  .refine((val) => isValidCepFormat(val), {
    message: 'CEP inválido. Informe 8 dígitos numéricos.',
  });

/**
 * UF validation against real Brazilian state list.
 */
const ufSchema = z.string()
  .trim()
  .toUpperCase()
  .refine((val) => val.length === 2 && isValidUF(val), {
    message: 'UF inválida. Informe uma sigla válida de estado brasileiro.',
  });

/**
 * Create address schema with strict allowlist (mass assignment protection).
 * Only permitted fields are accepted — userId, id, createdAt, updatedAt
 * are never accepted from client payload.
 */
export const createAddressSchema = z.object({
  label: z.string().max(50).trim().optional(),
  recipientName: z.string().min(2, 'Nome do destinatário é obrigatório (mín. 2 caracteres)').max(100).trim(),
  zipCode: cepSchema,
  street: z.string().min(2, 'Rua é obrigatória (mín. 2 caracteres)').max(200).trim(),
  number: z.string().min(1, 'Número é obrigatório').max(20).trim(),
  complement: z.string().max(100).trim().optional(),
  neighborhood: z.string().min(2, 'Bairro é obrigatório (mín. 2 caracteres)').max(100).trim(),
  city: z.string().min(2, 'Cidade é obrigatória (mín. 2 caracteres)').max(100).trim(),
  state: ufSchema,
  country: z.string().default('BR'),
  isDefault: z.boolean().optional().default(false),
}).strict(); // .strict() rejects unknown keys — mass assignment protection

/**
 * Update address schema — all fields optional but same validation rules apply.
 * Also uses .strict() for mass assignment protection.
 */
export const updateAddressSchema = z.object({
  label: z.string().max(50).trim().optional(),
  recipientName: z.string().min(2, 'Nome do destinatário é obrigatório (mín. 2 caracteres)').max(100).trim().optional(),
  zipCode: cepSchema.optional(),
  street: z.string().min(2, 'Rua é obrigatória (mín. 2 caracteres)').max(200).trim().optional(),
  number: z.string().min(1, 'Número é obrigatório').max(20).trim().optional(),
  complement: z.string().max(100).trim().optional(),
  neighborhood: z.string().min(2, 'Bairro é obrigatório (mín. 2 caracteres)').max(100).trim().optional(),
  city: z.string().min(2, 'Cidade é obrigatória (mín. 2 caracteres)').max(100).trim().optional(),
  state: ufSchema.optional(),
  country: z.string().optional(),
  isDefault: z.boolean().optional(),
}).strict(); // .strict() rejects unknown keys — mass assignment protection

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
