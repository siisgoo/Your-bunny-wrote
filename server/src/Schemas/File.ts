import { string, enums, object, number, Infer } from 'superstruct'

export const FileMimeSign = enums([
    "document", "pdf", "doc", "docx", "odt",
    "voice", "ogg",
    "image", "jpeg", "jpeg", "png", "bmp", "webm"
])

export const FileSign = object({
    file_id: number(),
    file_size: number(),
    file_mime: FileMimeSign,
    group: string(),
})

export type FileSchema = Infer<typeof FileSign>;
