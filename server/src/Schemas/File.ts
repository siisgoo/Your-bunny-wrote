import { string, object, number, Infer } from 'superstruct'

export const FileSign = object({
    file_id: number(),
    file_mime: string(),
    path: string(),
    group: string(),
})

export type FileSchema = Infer<typeof FileSign>;
