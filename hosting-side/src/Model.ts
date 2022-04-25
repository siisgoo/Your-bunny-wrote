import { ManagerSchema } from 'Schemas/Manager'
import { ChatMessage } from 'Schemas/ChatMessage'
import { IDBPDatabase, openDB, DBSchema } from './../node_modules/idb/build/index.js'
import { cookie } from './Cookie'
import { View } from './View'

interface HistoryIDBSchema extends DBSchema {
    history: {
        value: ChatMessage;
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

    public async getMessage(id: number): Promise<ChatMessage | undefined> {
        return await this.db.get("history", id);
    }

    public async getMessages(): Promise<ChatMessage[]> {
        return await this.db.getAll("history");
    }

    public async appendHistory(message: ChatMessage) {
        return await this.db.put("history", message);
    }
}

enum connState {
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

// enum modelState {
//     botOperation,
//     managerOperation,
//     waitingForManager,
//     readyToRestore,
// }

export type Commands = "ShowMessage" | "UpdateTitle"

export class Model {
    private view?: View;
    private hash: string;
    // @ts-ignore
    private connectionState: connState;
    private user: User;
    private history: History;
    private curManager: ManagerSchema;
    // @ts-ignore
    private socket: WebSocket;
    private url: string;
    private subtitle: string;

    private unhandledMessages: Array<ChatMessage>;

    private lastMessage?: ChatMessage;

    constructor(url: string) {
        this.subtitle = "";
        this.history = new History();
        this.unhandledMessages = new Array<ChatMessage>();
        this.hash = cookie.get("hash") ?? "";
        this.connectionState = connState.Disconnected;
        this.user = {
            username: cookie.get("username") ?? "",
            settings: {
                rememberMe: cookie.get("rememberMe") ? true : false
            }
        }
        // @ts-ignore
        this.curManager = JSON.stringify(cookie.get("manager"));
        // validate

        this.url = url;
    }

    async init() {
        this.socket = new WebSocket(this.url + "?hash="+this.hash)

        this.subtitle = "Connecting...";
        this.notify("newSubTitle");

        this.socket.onopen = () => {
            this.connectionState = connState.Connected;
            this.subtitle = "Connected";
            this.notify("newSubTitle");
        }

        this.socket.onclose = () => {
            this.connectionState = connState.Disconnected;
            this.subtitle = "";
            this.notify("newSubTitle");
            this.notify("serviceNotAvalible");
        }

        this.socket.onerror = () => {
            this.connectionState = connState.NotAvalible;
            this.notify("serviceNotAvalible");
        }

        this.socket.onmessage = (e: MessageEvent<{ event: string, payload: object }>) => {
            this.messageHandler(e);
        }

        if (this.curManager) {
            this.notify("newManager");
        }

        if (this.user.settings.rememberMe) {
            $("#chat-save-session").addClass("chat-settings-active");
        } else {
            cookie.set("saveChatSession", "false", {});
            $("#chat-save-session").addClass("chat-settings-diactive");
        }

        await this.history.open().then(() => {
            this.history.getMessages().then(msgs => {
                msgs.forEach(m => {
                    this.unhandledMessages.push(m);
                })
                this.lastMessage = msgs[msgs.length-1];
            });
            this.notify("newMessage");
        });
    }

    userName() {
        return this.user.username;
    }

    subTitle() {
        return this.subtitle;
    }

    manager(): ManagerSchema {
        return this.curManager;
    }

    pendingMessages() {
        let messages = this.unhandledMessages;
        this.unhandledMessages.splice(0);
        this.unhandledMessages.length = 0;
        return messages;
    }

    getLastMessage() {
        this.lastMessage;
    }

    setView(view: View) {
        this.view = view;
    }

    notify(cmd: string) {
        this.view?.update(cmd);
    }

    // TODO spam detect
    sendMessage(message: ChatMessage) {
        message.text.trim();

        let mustSend = true;
        if (message.text.indexOf("!") == 0) {
            let wordBreak = message.text.indexOf(" ");
            if (wordBreak == -1) {
                wordBreak = message.text.length;
            }
            let action = message.text.substr(1, wordBreak);
            mustSend = this.doAction(action, message.text.split(' '));
        }

        if (mustSend) {
            this.socket.send(JSON.stringify(message));
        }
    }

    receiveMessage(message: ChatMessage){
        this.unhandledMessages.push(message);
        this.notify('newMessage');
    }

    doAction(action: string, params: any[]): boolean {
        params.length = 0;
        switch (action) {
            case "clear": {
                // this.view.clearMessages();
                return false;
            }
            default: {
                return false;
            }
        }
    }

    resetChat() {
        this.history.drop();
        this.unhandledMessages.splice(0);
        this.unhandledMessages.length = 0;
        this.lastMessage = undefined;
    }

    messageHandler(e: MessageEvent<{ event: string, payload: object }>) {
        switch (e.data.event) {

        }
    }
}
