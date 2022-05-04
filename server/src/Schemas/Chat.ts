import { optional, nullable, object, boolean, number, string, Infer } from 'superstruct'

export enum ChatStage {
    startup = -1, // server reload handling only
    enteringName = 0,
    managerLink = 1,
    smartHandling = 2, // mean connected to bot logic. Rename?

    default = 0,
}

export type IChat = {
    hash?: string,
    initiator?: string,
    managerId?: number | null,
    waitingManager?: boolean,
    online?: boolean;
    stage?: ChatStage;
    ip: string,
}

export const ChatSign = object({
    hash: string(),
    initiator: optional(string()),
    managerId: nullable(number()),
    waitingManager: boolean(),
    online: boolean(),
    stage: number(),
    ip: string(),
})

export type ChatSchema = Infer<typeof ChatSign>;
