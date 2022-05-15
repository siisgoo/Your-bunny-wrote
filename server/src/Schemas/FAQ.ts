import { string, array, object, Infer } from 'superstruct'

export const FAQEntrySign = object({
    keywords: array(string()),
    answer: string()
})

export type FAQEntrySchema = Infer<typeof FAQEntrySign>;
