import * as fs from 'fs'
import * as crypt from 'crypto'
import * as https from 'https'
import * as mime from 'mime-types'
import { Database as ADatabase } from 'aloedb-node'
import { assert, object, boolean, string, Infer } from 'superstruct'
import { randomUUID } from 'crypto'
import { Config } from './Config.js'

import { FileSchema, FileSign } from './Schemas/File.js'
import { ManagerSign, ManagerSchema, IManager } from './Schemas/Manager.js'
import { ChatMessage, ChatMessageSign } from './Schemas/ChatMessage.js'
import { ChatSign, ChatSchema, IChat } from './Schemas/Chat.js'

// TODO add some caching abilities

const dirs = [
    Config().server.database.path,
    Config().server.fileStorage.path,
    Config().server.fileStorage.path,
    Config().server.fileStorage.path + "/static"
]

for (let dir of dirs) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

const MessageSign = object({
    message: ChatMessageSign,
    chatHash: string(),
    readed: boolean(),
})

export type MessageSchema = Infer<typeof MessageSign>;

const ChatEntryValidator = (document: any) => assert(document, ChatSign)
const ManagerEntryValidator = (document: any) => assert(document, ManagerSign)
const MessageEntryValidator = (document: any) => assert(document, MessageSign)
const FileEntryValidator = (document: any) => assert(document, FileSign)

const managers = new ADatabase<ManagerSchema>({
    path: Config().server.database.path + "/managers.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: ManagerEntryValidator
});

const chats = new ADatabase<ChatSchema>({
    path: Config().server.database.path + "/chats.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: ChatEntryValidator
});

const history = new ADatabase<MessageSchema>({
    path: Config().server.database.path + "/history.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: MessageEntryValidator,
});

const files_db = new ADatabase<FileSchema>({
    path: Config().server.database.path + "/files.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: FileEntryValidator,
});

// TODO purpose - delete emty chats and split or delete old messages
// class Cleaner {

// }

if (!fs.existsSync(Config().server.fileStorage.path + "/static/manager-icon.png")) {
    console.log(process.cwd());
    fs.copyFileSync("assets/manager-icon.png", Config().server.fileStorage.path + "/static/manager-icon.png")
    files_db.insertOne({
        file_id: 0,
        file_mime: "image/png",
        path: Config().server.fileStorage.path + "/static/manager-icon.png",
        group: "static",
    })
}

export class Files {
    constructor() { }

    async getFile(id: number): Promise<FileSchema | null> {
        return await files_db.findOne({ file_id: id });
    }

    async saveFile(url: string, group: string) {
        return await https.get(url, (res) => {
            if (res.statusCode == 200) { // best string size: Number.MAX_INT ... TODO
                const filename = crypt.randomBytes(30).toString().slice(0, 30);
                const path = Config().server.fileStorage.path + "/" + filename;
                const filepath = fs.createWriteStream(path);
                res.pipe(filepath);
                filepath.on("finish", () => {
                    files_db.insertOne({
                        file_id: crypt.randomInt(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
                        file_mime: mime.lookup(path) || "unknown",
                        path: path,
                        group: group
                    })
                });

                return true;
            } else {
                return false;
            }
        })
    }

    async getDefaultAvatar(): Promise<FileSchema> {
        return <FileSchema>(await this.getFile(0));
    }
}

export const Database = { managers, chats, history, files: new Files() }

export class Message implements MessageSchema {
    message: ChatMessage;
    chatHash: string;
    readed: boolean;

    constructor(msg: ChatMessage, chat: string, readed = true) {
        this.message = msg;

        this.chatHash = chat;
        this.readed = readed;
    }

    async sync() {
        if (await history.findOne({ chatHash: this.chatHash, message: { id: this.message.id } })) {
            return await history.updateOne({ chatHash: this.chatHash, message: { id: this.message.id } }, this);
        } else {
            return await history.insertOne(this);
        }
    }

    async remove() {
        // TODO its work? or use func
        return await history.deleteOne({ chatHash: this.chatHash, message: { id: this.message.id } });
    }

    static async findOne(query: Partial<MessageSchema>): Promise<Message | null> {
        const object = await history.findOne(query);
        if (object) return new Message(object.message, object.chatHash, object.readed);
        return null;
    }

    static async findMany(query: Partial<MessageSchema>): Promise<Message[]> {
        const objects = await history.findMany(query);

        return objects.map((obj) => {
            return new Message(obj.message, obj.chatHash, obj.readed);
        });
    }
}

export class Chat implements IChat {
    // id: number;
    readonly hash: string;
    initiator: string;
    managerId: number | null;
    waitingManager: boolean;
    online: boolean;
    ip: string;

    constructor(chat: IChat) {
        this.hash = chat.hash ?? randomUUID();
        this.initiator = chat.initiator ?? "Client";
        this.managerId = chat.managerId ?? null;
        this.waitingManager = chat.waitingManager ?? false;
        this.online = chat.online ?? false;
        this.ip = chat.ip;
    }

    async sync() {
        if (await chats.findOne({ hash: this.hash })) {
            return await chats.updateOne({ hash: this.hash }, this);
        } else {
            return await chats.insertOne(this);
        }
    }

    async remove() {
        return await chats.deleteOne({ hash: this.hash });
    }

    async lastMessageId(): Promise<number> {
        return await history.findMany({ chatHash: this.hash }).then(msgs =>
            ( msgs.length ? msgs[msgs.length - 1].message.id : 0 ))
    }

    async appendHistory(message: ChatMessage, readed: boolean = true) {
        // return await (new Message(message, this.hash, readed)).sync();
        return await history.insertOne({
            message: message,
            chatHash: this.hash,
            readed: readed
        })
    }

    async getHistory() {
        return await history.findMany({ chatHash: this.hash });
    }

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

export class Manager implements IManager {
    userId: number; // telegram user id
    name: string;
    isAdmin: boolean;
    linkedChat: string | null;
    online: boolean;
    avatar: FileSchema;

    constructor(mngr: IManager) {
        this.userId = mngr.userId;
        this.name = mngr.name;
        this.isAdmin = mngr.isAdmin ?? false;
        this.linkedChat = mngr.linkedChat ?? null;
        this.online = mngr.online ?? false;
        this.avatar = mngr.avatar;
    }

    async sync() {
        if (await managers.findOne({ userId: this.userId })) {
            return managers.updateOne({ userId: this.userId }, this);
        } else {
            return managers.insertOne(this);
        }
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
