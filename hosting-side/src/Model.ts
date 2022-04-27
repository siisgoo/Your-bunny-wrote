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
    private curManager?: ManagerSchema;
    // @ts-ignore
    private socket: WebSocket;
    private url: string;
    private subtitle: string;
    private lastManagerEvent: string;

    private unhandledMessages: Array<ChatMessage>;

    private lastMessage?: ChatMessage;

    constructor(url: string) {
        this.lastManagerEvent = "";
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
        // this.curManager = JSON.stringify(cookie.get("manager"));
        // validate

        this.url = url;
        console.log(url)
    }

    deconstructor() {
        if (this.socket.readyState == WebSocket.OPEN) {
            if (this.user.settings.rememberMe) {
                this.socket.close(0, "Reloading"); // TODO constants
            } else {
                this.socket.close(1, "Destroy");
            }
        }
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

    getCurManager() {
        return this.curManager;
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

    getLastManagerEvent() {
        return this.lastManagerEvent;
    }

    subTitle() {
        return this.subtitle;
    }

    manager(): ManagerSchema | undefined {
        return this.curManager;
    }

    pendingMessages() {
        let messages = this.unhandledMessages.splice(0);
        this.unhandledMessages.length = 0;
        return messages;
    }

    getLastMessage() {
        return this.lastMessage;
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
        this.lastMessage = message;
    }

    // TODO validate
    receiveMessage(message: ChatMessage){
        this.unhandledMessages.push(message);
        this.lastMessage = message;
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

    toggleRememberMe() {
        this.user.settings.rememberMe = !this.user.settings.rememberMe;
        cookie.set("rememberMe", String(this.user.settings.rememberMe), {});
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
                data.payload.history.map(( m: ChatMessage ) => {
                    this.unhandledMessages.push(m);
                })
                this.notify("newMessage");

                if (data.payload.chat.managerId) {
                this.subtitle = data.payload.manager.name;
                this.notify("newSubTitle")
                }
                break;
            }
            case "message": {
                this.unhandledMessages.push(data.payload.message);
                this.notify("newMessage");
                break;
            }
            case "managerEvent": {
                this.lastManagerEvent = data.payload.event.name;
                this.notify("newManagerEvent");
                break;
            }
            case "accept": {
                this.subtitle = data.payload.manager.name;
                this.curManager = data.payload.manager;
                this.notify("newSubTitle")
                break;
            }
            case "close": {
                this.subtitle = "Connected";
                this.notify("newSubTitle");
                break;
            }
            case "leave": {
                this.subtitle = "Connected";
                this.notify("newSubTitle");
                break;
            }
            default:
                console.log("Unrekognie");
        }
    }
}
