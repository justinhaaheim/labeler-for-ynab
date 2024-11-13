import {z} from 'zod';

export const YNABSaveTransactionWithIdOrImportIdZod = z.object({
  memo: z.string().optional(),
});
