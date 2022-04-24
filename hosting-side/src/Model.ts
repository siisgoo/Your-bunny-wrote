import { ManagerSchema } from 'Schemas/Manager'
import { ClientChatMessage } from 'Schemas/ChatMessage'
import { IDBPDatabase, openDB, DBSchema } from './../node_modules/idb/build/index.js'

interface HistoryIDBSchema extends DBSchema {
    history: {
        value: ClientChatMessage;
        key: number;
        indexes: { 'by-id': number }
    }
}

export class History {
    // @ts-ignore
    private db: IDBPDatabase<HistoryIDBSchema>;

    constructor() {
    }

    public async open() {
        const l_db: typeof this.db = await openDB<HistoryIDBSchema>('rediirector', 1, {
            upgrade(l_db) {
                l_db.createObjectStore('history', {
                    keyPath: 'id'
                })
                .createIndex("by-id", "id");
            }
        })

        this.db = l_db;
    }

    public async drop() {
        return await this.db.clear("history");
    }

    public async getMessage(id: number): Promise<ClientChatMessage | undefined> {
        return await this.db.get("history", id);
    }

    public async getMessages(): Promise<ClientChatMessage[]> {
        return await this.db.getAll("history");
    }

    public async appendHistory(message: ClientChatMessage) {
        return await this.db.put("history", message);
    }
}

enum State {
    Connected,
    Disconnected,
    NotAvalible,
}

interface Settings {
    rememberMe: boolean;
}

interface User {
    username: string;
    settings: Settings;
}

export interface IModel {
    hash: string;
    connectionState: State;
    user: User;
    history: History;
    curManager: ManagerSchema;
}
