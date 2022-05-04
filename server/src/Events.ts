import { ChatMessage } from './Schemas/ChatMessage.js'
import { FileSchema } from './Schemas/File.js'
import { ChatSchema } from './Schemas/Chat.js'
import { ManagerSchema } from './Schemas/Manager.js'

export type res_em = {
    "created": { payload: { hash: string } };
    "restored": {
        payload: {
            chat: ChatSchema,
            history: ChatMessage[]
        }
    };
    "accept": { payload: { manager: ManagerSchema } };
    "message": ChatMessage;
    "close": void;
    "leave": void;
    "ping": void;
    "file": {
        config: {
            id: string;
        }
        file: FileSchema
    };
}

// export const res_em_sign = object({
//     "created": object(object({ hash: string() })),
//     "restored": object({
//         chat: ChatSchema,
//         history: ChatMessage[]
//     }),
//     "accept": { payload: { manager: ManagerSchema } },
//     "message": ChatMessage,
//     "close": void,
//     "leave": void,
//     "ping": void,
//     "file": {
//         config: {
//             id: string;
//         }
//         file: FileSchema
//     },
// })

export type req_em = {
    "managerReq": void;
    "getOnline": void;
    "message": ChatMessage;
    "file": { id: number, config: { id: string } } ;
    "pong": void;
}
