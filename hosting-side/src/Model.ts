import { ManagerSchema } from 'Schemas/Manager.js'
import { ChatMessage } from 'Schemas/ChatMessage.js'
import { IDBPDatabase, openDB, DBSchema } from './../node_modules/idb/build/index.js'
import { cookie } from './Cookie.js'
import { View } from './View.js'

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
        console.log(url)
    }

    async init() {
        this.connect();
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

        this.notify('setSpiner');
    }

    connect() {
        this.socket = new WebSocket(this.url)

        this.subtitle = "Connecting...";
        this.notify("newSubTitle");

        this.socket.onopen = () => {
            this.connectionState = connState.Connected;
            this.subtitle = "Connected";
            this.notify("newSubTitle");

            let req = { hash: this.hash }
            this.socket.send(JSON.stringify(req));
        }

        this.socket.onclose = (e) => {
            this.connectionState = connState.Disconnected;
            if (e.code !== 1006) {
                this.subtitle = "Not avalible";
                this.notify("newSubTitle");
            }
            this.notify('setSpiner');
            //handle code
            setTimeout(() => this.connect(), 5000);
        }

        this.socket.onerror = (e) => {
            this.connectionState = connState.NotAvalible;
            this.subtitle = "Not avalible";
            this.notify("newSubTitle");
            this.notify('setSpiner');
            //handle code
            console.log("ERR", e);
            (async () => setTimeout(() => this.notify("disable"), 1000))();
        }

        this.socket.onmessage = (e: MessageEvent<{ event: string, payload: object }>) => {
            this.messageHandler(e);
        }

    }

    ok() {
        return this.connectionState == connState.Connected;
    }

    settings() {
        return this.user.settings;
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
        let messages = this.unhandledMessages.splice(0);
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
            this.socket.send(JSON.stringify({
                target: "message",
                payload: {
                    message: message
                }
            }));
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
                this.view?.notify("clear");
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
        this.notify("clear");
    }

    messageHandler(e: MessageEvent) {
        let data = JSON.parse(e.data);
        console.log(data);
        switch (data.event) {
            case "created": {
                this.notify('unsetSpiner');
                this.hash = data.payload.hash;
                cookie.set("hash", this.hash, {})
                break;
            }
            case "restored": {
                this.resetChat();
                this.notify('unsetSpiner');
                data.payload.history.forEach(( m: ChatMessage ) => {
                    this.unhandledMessages.push(m);
                })
                this.notify("newMessage");
                break;
            }
            case "message": {
                this.unhandledMessages.push(data.payload.message);
                this.notify("newMessage");
                break;
            }
            case "managerConnected": {
                break;
            }
            default:
                console.log("Unrekognie");
        }
    }
}
