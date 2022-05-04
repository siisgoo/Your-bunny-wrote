import { ManagerSchema } from 'Schemas/Manager.js'
import { ChatMessage } from 'Schemas/ChatMessage.js'
import { cookie } from './Cookie.js'
import { FileSchema } from 'Schemas/File.js'
import { EventEmitter } from './EventEmitter.js'

interface Settings {
    rememberMe: boolean;
}

interface User {
    username: string;
    settings: Settings;
}

interface m_em {
    init: void;
    setLoading: void;
    unsetLoading: void;
    setStatus: string;
    fileLoaded: string;
    newMessage: ChatMessage;
    clear: void;
}

export class Model extends EventEmitter<m_em> {
    private hash: string;
    private user: User;
    private curManager?: ManagerSchema;
    // @ts-ignore
    private socket: WebSocket;
    private url: URL;
    private lastManagerEvent: string;

    private lastMessage?: ChatMessage;

    constructor(url: URL) {
        super();
        this.lastManagerEvent = "";
        this.hash = cookie.get("hash") ?? "";
        this.user = {
            username: cookie.get("username") ?? "",
            settings: {
                rememberMe: cookie.get("rememberMe") ? true : false
            }
        }

        this.url = url;
    }

    deconstructor() {
    }

    async init() {
        this.connect();
        if (this.user.settings.rememberMe) {
            $("#chat-save-session").addClass("chat-settings-active");
        } else {
            cookie.set("rememberMe", "false", {});
            $("#chat-save-session").addClass("chat-settings-diactive");
        }

        this.emit("setLoading")
    }

    disconnect() {
        this.socket.onclose = () => {}
        this.socket.onerror = () => {}
        if (this.socket.readyState != WebSocket.CLOSED || this.socket.readyState != WebSocket.CONNECTING) {
            if (this.user.settings.rememberMe) {
                this.socket.close(4001, "Reloading"); // TODO constants
            } else {
                this.socket.close(4002, "Destroy");
            }
        }
    }

    connect() {
        this.socket = new WebSocket(this.url+"?hash="+this.hash);

        this.emit("setStatus", "Connecting...");

        this.socket.onopen = () => {
            this.emit("setStatus", "Connected");
        }

        this.socket.onclose = (e) => {
            if (e.code !== 1006) {
                this.emit("setStatus", "Not avalible");
            }
            this.emit('setLoading');
            // reconnection in 5 sec
            setTimeout(() => this.connect(), 5000);
        }

        this.socket.onerror = (e) => {
            this.emit("setStatus", "Service not avalible");
            this.emit('setLoading');
            console.log("Socket error", e);
            // (async () => setTimeout(() => this.notify("disable"), 1000))();
        }

        this.socket.onmessage = (e: MessageEvent<{ event: string, payload: object }>) => {
            this.messageHandler(e);
        }
    }

    isConnected() {
        return this.socket.readyState == WebSocket.OPEN;
    }

    getServerUrl() {
        return this.url;
    }

    getCurManager() {
        return this.curManager;
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

    manager(): ManagerSchema | undefined {
        return this.curManager;
    }

    getLastMessage() {
        return this.lastMessage;
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
        this.lastMessage = message;
        this.emit('newMessage', message);
    }

    doAction(action: string, params: any[]): boolean {
        params.length = 0;
        switch (action) {
            case "clear": {
                this.emit("clear");
                return false;
            }
            default: {
                return false;
            }
        }
    }

    resetChat() {
        this.lastMessage = undefined;
        this.emit("clear");
    }

    toggleRememberMe() {
        this.user.settings.rememberMe = !this.user.settings.rememberMe;
        cookie.set("rememberMe", String(this.user.settings.rememberMe), {});
    }

    messageHandler(e: MessageEvent) {
        let data = JSON.parse(e.data);
        switch (data.event) {
            case "created": {
                this.emit("unsetLoading");
                this.hash = data.payload.hash;
                cookie.set("hash", this.hash, {})
                break;
            }
            case "restored": {
                this.resetChat();
                this.emit('unsetLoading');
                data.payload.history.map(( m: ChatMessage ) => {
                    this.receiveMessage(m);
                })

                if (data.payload.chat.managerId) {
                    this.curManager = data.payload.manager;
                    // forse reload
                    this.requestFile(this.curManager!.avatar, this.curManager!.userId);
                    this.emit("setStatus", data.payload.manager.name)
                }
                break;
            }
            case "message": {
                this.receiveMessage(data.payload.message)
                break;
            }
            // case "managerEvent": {
            //     this.lastManagerEvent = data.payload.event.name;
            //     // this.emit("newManagerEvent");
            //     break;
            // }
            case "accept": {
                this.curManager = data.payload.manager;
                this.requestFile(this.curManager!.avatar, this.curManager!.userId);
                this.emit("setStatus", data.payload.manager.name)
                break;
            }
            case "closed": {
                this.emit("setStatus", "Connected");
                break;
            }
            case "leaved": {
                this.emit("setStatus", "Connected");
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
                localStorage.setItem(data.payload.config.id, JSON.stringify(data.payload));
                this.emit("fileLoaded", data.payload.config.id);
                break;
            }
            case "error": {
                console.log(data);
                break;
            }
            default:
                console.error("DEBUG: Unrekognized event in message: ", data);
        }
    }
}
