import { z } from 'zod';

export const builderItemSchema = z
  .object({
    category: z.enum(['case', 'pcb', 'plate', 'switch', 'keycap', 'extra']),
    variantId: z.string().uuid('ID de variante inválido'),
    quantity: z.number().int().min(1, 'Quantidade mínima é 1').max(99, 'Quantidade máxima é 99'),
  })
  .strict();

export const builderConfigurationSchema = z
  .object({
    layout: z.string().min(1).max(20).nullable().optional(),
    items: z.array(builderItemSchema).min(1, 'Configuração vazia').max(30, 'Configuração com itens demais'),
  })
  .strict();

export type BuilderItemInput = z.infer<typeof builderItemSchema>;
export type BuilderConfigurationInput = z.infer<typeof builderConfigurationSchema>;
