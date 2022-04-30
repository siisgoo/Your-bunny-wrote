import { optional, nullable, object, boolean, number, string, Infer } from 'superstruct'

export type IChat = {
    hash?: string,
    initiator?: string,
    managerId?: number | null,
    waitingManager?: boolean,
    online?: boolean;
    ip: string,
}

export const ChatSign = object({
    hash: string(),
    initiator: optional(string()),
    managerId: nullable(number()),
    waitingManager: boolean(),
    online: boolean(),
    ip: string(),
})

export type ChatSchema = Infer<typeof ChatSign>;
