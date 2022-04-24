import { enums, object, number, Infer } from 'superstruct'

export const FileMimeSign = enums([
    "pdf",
    "doc", "docx",
    "odt",
    "TODO voice",
    "jpeg", "jpeg", "png", "bmp", "webm"
])

export const FileSign = object({
    file_id: number(),
    file_size: number(),
    file_mime: FileMimeSign,
})

export type FileSchema = Infer<typeof FileSign>;
