import { ManagerSchema } from 'Schemas/Manager.js'
import { ChatMessage } from 'Schemas/ChatMessage.js'
import { cookie } from './Cookie.js'
import { View } from './View.js'
import { FileSchema } from 'Schemas/File.js'

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

// export type Commands = "ShowMessage" | "UpdateTitle"

export class Model {
    private view?: View;
    private hash: string;
    // @ts-ignore
    private connectionState: connState;
    private user: User;
    private curManager?: ManagerSchema;
    // @ts-ignore
    private socket: WebSocket;
    private url: URL;
    private subtitle: string;
    private lastManagerEvent: string;

    private unhandledMessages: Array<ChatMessage>;

    private lastMessage?: ChatMessage;

    constructor(url: URL) {
        this.lastManagerEvent = "";
        this.subtitle = "";
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
    }

    async init() {
        this.connect();
        if (this.curManager) {
            this.notify("newManager");
        }

        if (this.user.settings.rememberMe) {
            $("#chat-save-session").addClass("chat-settings-active");
        } else {
            cookie.set("rememberMe", "false", {});
            $("#chat-save-session").addClass("chat-settings-diactive");
        }

        this.notify('setSpiner');
    }

    disconnect() {
        this.socket.onclose = () => {}
        this.socket.onerror = () => {}
        if (this.socket.readyState != WebSocket.CLOSED || this.socket.readyState != WebSocket.CONNECTING) {
            console.log("Closing", this.user.settings.rememberMe)
            if (this.user.settings.rememberMe) {
                this.socket.close(4001, "Reloading"); // TODO constants
            } else {
                this.socket.close(4002, "Destroy");
            }
        }
    }

    connect() {
        console.log("Connecting:", this.url+"?hash="+this.hash);
        this.socket = new WebSocket(this.url+"?hash="+this.hash);

        this.subtitle = "Connecting...";
        this.notify("newSubTitle");

        this.socket.onopen = () => {
            this.connectionState = connState.Connected;
            this.subtitle = "Connected";
            this.notify("newSubTitle");
        }

        this.socket.onclose = (e) => {
            this.connectionState = connState.Disconnected;
            console.log("Discon:", e);
            if (e.code !== 1006) {
                this.subtitle = "Not avalible";
                this.notify("newSubTitle");
            }
            this.notify('setSpiner');
            // reconnection in 5 sec
            setTimeout(() => this.connect(), 5000);
        }

        this.socket.onerror = (e) => {
            console.log("Error:", e);
            this.connectionState = connState.NotAvalible;
            this.subtitle = "Not avalible";
            this.notify("newSubTitle");
            this.notify('setSpiner');
            (async () => setTimeout(() => this.notify("disable"), 1000))();
        }

        this.socket.onmessage = (e: MessageEvent<{ event: string, payload: object }>) => {
            this.messageHandler(e);
        }

    }

    getServerUrl() {
        return this.url;
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

    getFile(id: string): { file: FileSchema, data: Buffer } | null {
        let file = localStorage.getItem(id);
        if (file) {
            return JSON.parse(file);
        }
        return null;
    }

    requestFile(id: number, toSetId: number) {
        this.socket.send(JSON.stringify({
            target: "file",
            payload: { file: { id: id }, config: { id: toSetId } }
        }))
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
    receiveMessage(message: ChatMessage) {
        this.unhandledMessages.push(message);
        this.lastMessage = message;
        this.notify('newMessage');
    }

    doAction(action: string, params: any[]): boolean {
        params.length = 0;
        switch (action) {
            case "clear": {
                this.notify("clear");
                return false;
            }
            default: {
                return false;
            }
        }
    }

    resetChat() {
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
                    this.receiveMessage(m);
                })
                // this.notify("newMessage");

                if (data.payload.chat.managerId) {
                    this.curManager = data.payload.manager;
                    this.subtitle = data.payload.manager.name;
                    this.notify("newSubTitle")
                }
                break;
            }
            case "message": {
                this.receiveMessage(data.payload.message)
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
                this.requestFile(this.curManager!.avatar.file_id, this.curManager!.userId);
                this.notify("newSubTitle")
                break;
            }
            case "closed": {
                this.subtitle = "Connected";
                this.notify("newSubTitle");
                break;
            }
            case "leaved": {
                this.subtitle = "Connected";
                this.notify("newSubTitle");
                break;
            }
            case "ping": {
                this.socket.send(JSON.stringify({
                    target: "pong",
                    payload: {}
                }))
                break;
            }
            case "file": {
                this.notify("file");
                localStorage.setItem(data.payload.config.id, JSON.stringify(data.payload));
                break;
            }
            case "error": {
                console.log(data);
                break;
            }
            default:
                console.log("Unrekognie");
        }
    }
}
