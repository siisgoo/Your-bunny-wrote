import * as fs from 'fs';
import { Database as ADatabase } from 'aloedb-node';
import { assert, nullable, object, boolean, number, string, Infer } from 'superstruct';
// import cache from 'node-cache';

import './../../shared-types';

// TODO add some caching abilities

const storagePath = "./storage";

if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath)
}

// TODO (its from shared-types.d.ts)
// const SenderTypeArray = [ "bot", "customer", "manager" ];
// const sendertype = () => define('sendertype', (value) => SenderTypeArray.includes(<string>value))

// WARN: no change ChatMessage interface its must be served
const MessageSign = object({
    id: number(),
    stamp: number(),
    from: object({
        type: string(),
        name: string(),
    }),
    text: nullable(string()),
    image: nullable(
        object({
            file_id: number(),
            file_size: number(),
        })
    ),
    file: nullable(
        object({
            file_id: number(),
            file_size: number(),
            mime: string(),
        })
    ),
    voice: nullable(
        object({
            file_id: number(),
            file_size: number(),
            duration: number(),
        })
    ),
    avatar: nullable(
        object({
            file_id: number()
        })
    ),
    chatId: number(),
    readed: boolean()
})

const ChatSign = object({
    hash: string(),
    initiator: string(),
    managerId: nullable(number()),
})

const ManagerSign = object({
    userId: number(),
    isAdmin: boolean(),
    linkedChat: nullable(string()),
    online: boolean(),
})

const ChatEntryValidator = (document: any) => assert(document, ChatSign)
const ManagerEntryValidator = (document: any) => assert(document, ManagerSign)
const MessageEntryValidator = (document: any) => assert(document, MessageSign)

const managers = new ADatabase<ManagerSchema>({
    path: storagePath + "/managers.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: ManagerEntryValidator
});

const chats = new ADatabase<ChatSchema>({
    path: storagePath + "/chats.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: ChatEntryValidator
});

const history = new ADatabase<MessageSchema>({
    path: storagePath + "/chats.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: MessageEntryValidator,
});

export const Database = { managers, chats, history }

type ChatSchema = Infer<typeof ChatSign>;
type MessageSchema = Infer<typeof MessageSign>;
type ManagerSchema = Infer<typeof ManagerSign>;

export interface IMessage extends ChatMessage {
    chatId: number,
    readed: boolean,
}

export class Message {
    id: number;
    stamp: number;
    from: {
        // type: SenderType;
        type: string;
        name: string;
    };

    text: string | null;

    image: {
        file_id: number;
        file_size: number;
    } | null;

    file: {
        file_id: number;
        file_size: number;
        // mime: FileMimeType;
        mime: string;
    } | null;

    voice: {
        file_id: number;
        file_size: number;
        duration: number;
    } | null;

    avatar: {
        file_id: number;
    } | null;

    chatId: number;
    readed: boolean;

    constructor(msg: IMessage) {
        this.id = msg.id;
        this.stamp = msg.stamp;
        this.from = msg.from;
        this.text = msg.text ?? "";
        this.image = msg.image ?? null;
        this.file = msg.file ?? null;
        this.voice = msg.voice ?? null;
        this.avatar = msg.avatar ?? null;

        this.chatId = msg.chatId;
        this.readed = msg.readed;
    }

    sync() {
        history.insertOne(this);
    }

    remove() {
        history.deleteOne({ id: this.id });
    }

    static async findOne(query: Partial<MessageSchema>): Promise<Message | null> {
        const object = await history.findOne(query);
        if (object) return new Message(object);
        return null;
    }

    static async findMany(query: Partial<MessageSchema>): Promise<Message[]> {
        const objects = await history.findMany(query);

        return objects.map((obj) => {
            return new Message(obj);
        });
    }
}

export interface IChat {
    // id?: number,
    hash: string,
    initiator: string,
    managerId?: number | null,
}

export class Chat {
    // id: number;
    hash: string;
    initiator: string;
    managerId: number | null;

    constructor(chat: IChat) {
        // this.id = chat.id ?? chats.count();
        this.hash = chat.hash;
        this.initiator = chat.initiator;
        this.managerId = chat.managerId ?? null;
    }

    sync() {
        chats.insertOne(this);
        return this;
    }

    remove() {
        chats.deleteOne({ hash: this.hash });
        return this;
    }

    // pushMessage(message: IMessage) {
    // }

    static async findOne(query: Partial<ChatSchema>): Promise<Chat | null> {
        const object = await chats.findOne(query);
        if (object) return new Chat(object);
        return null;
    }

    static async findMany(query: Partial<ChatSchema>): Promise<Chat[]> {
        const objects = await chats.findMany(query);

        return objects.map((obj) => {
            return new Chat(obj);
        });
    }
}

export interface IManager {
    userId: number; // telegram user id
    isAdmin: boolean;
    linkedChat: string | null;
    online: boolean;
}

export class Manager {
    userId: number; // telegram user id
    isAdmin: boolean;
    linkedChat: string | null;
    online: boolean;

    constructor(mngr: IManager) {
        this.userId = mngr.userId;
        this.isAdmin = mngr.isAdmin;
        this.linkedChat = mngr.linkedChat;
        this.online = mngr.online;
    }

    sync() {
        return managers.insertOne(this);
    }

    remove() {
        return managers.deleteOne({ userId: this.userId });
    }

    // TODO make linkToChat as an object and choose sync by objec creation
    linkToChat(hash: string) {
        this.linkedChat = hash;
        return managers.updateOne({ linkedChat: hash }, this);
    }

    unlinkChat() {
        this.linkedChat = null;
        return managers.updateOne({ linkedChat: null }, this);
    }

    static async findOne(query: Partial<IManager>): Promise<Manager | null> {
        const object = await managers.findOne(query);
        if (object) return new Manager(object);
        return null;
    }

    static async findMany(query: Partial<IManager>): Promise<Manager[]> {
        const objects = await managers.findMany(query);

        return objects.map((obj) => {
            return new Manager(obj);
        });
    }
}

// TODO purpose - delete emty chats and split or delete old messages
// class Cleaner {

// }
