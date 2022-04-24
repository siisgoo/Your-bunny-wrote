import { Infer, nullable, array, enums, object, number, string } from 'superstruct'
import { FileSign, FileMimeSign } from './File'

const SenderTypeSign = enums([ "bot",  "customer",  "manager" ]);

export const ChatMessageSign = object({
    id: number(),
    stamp: number(),
    from: object({
        type: SenderTypeSign,
        name: string()
    }),
    text: nullable(string()),

    attachments: array( FileSign )
})

export type ChatMessage = Infer<typeof ChatMessageSign>;

export const ClientChatMessageSign = object({
    id: number(),
    stamp: number(),
    from: object({
        type: SenderTypeSign,
        name: string()
    }),
    text: nullable(string()),

    attachments: array(
        object({
            data: string(),
            mime: FileMimeSign
        })
    )
})

export type ClientChatMessage = Infer<typeof ClientChatMessageSign>
