import { ChatMessage } from './Schemas/ChatMessage.js'
// import { ManagerSchema } from './database.js'

//export interface Response<T extends keyof EventsMap> {
//    event: T,
//    payload: EventsMap[T],
//}

////

export interface TargetMap extends Record<string, object> {
    'message': {
        message: ChatMessage
    },
    'managerRequest': { },
    'getOnline': {  },
}

export interface Request<T extends keyof TargetMap> {
    target: T,
    payload: TargetMap[T],
}

export type ServerDisconnectReason = "Timeout" | "ClosedByManager";
export type ClientDisconnectReason = "EndChat" | "Reloading";
