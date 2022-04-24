import { optional, array, Infer, enums, object, number, string } from 'superstruct'
// import { FileSign, FileMimeSign } from './File'

const SenderSign = enums([ "bot",  "customer",  "manager" ]);

export const ChatMessageSign = object({
    id: number(),
    stamp: number(),
    from: object({
        type: SenderSign,
        name: string()
    }),
    text: string(),

    buttons: optional(
        array(
            object({
                name: string(),
                value: string(),
            })
        )
    )

    // attachments: array( FileSign )
})

export type ChatMessage = Infer<typeof ChatMessageSign>;

// export const ClientChatMessageSign = object({
//     id: number(),
//     stamp: number(),
//     from: object({
//         type: SenderTypeSign,
//         name: string()
//     }),
//     text: string(),

//     // attachments: array(
//     //     object({
//     //         data: string(),
//     //         mime: FileMimeSign
//     //     })
//     // )
// })

// export type ClientChatMessage = Infer<typeof ClientChatMessageSign>
