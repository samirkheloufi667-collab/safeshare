import { z } from 'zod';

/** Valide et convertit une entrée ; une erreur Zod devient une réponse 400 lisible (voir errors.ts). */
export const parse = <T extends z.ZodType>(schema: T, input: unknown): z.infer<T> => schema.parse(input);

export const id = z.string().min(1).max(40);
export const name = z
  .string({ message: 'Nom requis' })
  .trim()
  .min(1, 'Le nom ne peut pas être vide')
  .max(200, 'Nom trop long (200 caractères maximum)');
