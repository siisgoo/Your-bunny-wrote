import { FileSign, FileSchema } from './File.js'
import { nullable, number, object, boolean, string, Infer } from 'superstruct'

export const ManagerSign = object({
    userId: number(),
    name: string(),
    isAdmin: boolean(),
    linkedChat: nullable(string()),
    online: boolean(),
    avatar: FileSign
})

export type ManagerSchema = Infer<typeof ManagerSign>;

export interface IManager { // TODO avatar
    userId: number; // telegram user id
    name: string,
    isAdmin?: boolean;
    linkedChat?: string | null;
    online?: boolean;
    avatar: FileSchema;
}
