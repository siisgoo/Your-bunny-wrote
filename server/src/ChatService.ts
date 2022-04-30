// @ts-ignore
import express, { Express, Request, Response  } from 'express'
import * as fs from 'fs'
import * as http from 'http'
import * as ws from 'ws'
import { Database, Chat, Manager } from './database.js'
import { ManagerSchema } from './Schemas/Manager'
import { Config } from './Config.js'
import { ChatMessage } from './Schemas/ChatMessage'
import localtunnel from 'localtunnel'

// import { Response as ChatResponse } from './Events.js';

let Bot = (() => {
    const botName = "Tech-bot";

    // use Pick
    type botMsgPreset = { text: string, buttons?: { name: string, value: string }[] }

    type messageType = "startup" |
        "enterName" |
        "returnToManager" |
        "waitForManager" |
        "chatClosed" |
        'managerLeaved' |
        "historyTurnDelete" |
        "historyTurnSave" |
        "internalError" |
        "serviceNotAvalible" |
        "whatBotCan" |
        "unrekognized" |
        "botCommands"

    const messages: Record<messageType, botMsgPreset> = {
        "startup":           { text: 'Я - ' + botName },
        "enterName":         { text: "Как к вам обращаться?" },
        "returnToManager":   { text: "Тут я бессилен, вызываю оператора." },
        "waitForManager":    { text: "Пожалуйста, подождите, вам скоро ответят." },
        "chatClosed":        { text: "Чат закрыт, надеюсь мы помогли вам." },
        'managerLeaved':     { text: "Менеджер вышел из чата, ищем вам другого." },
        "historyTurnDelete": { text: "Сообщения больше не будут сохраняться в историю" },
        "historyTurnSave":   { text: "Сообщения будут сохраняться в историю" },
        "internalError":     { text: "Ой-ой. Что то пошло не так, пожалуйста, презагрузите страницу." },
        "serviceNotAvalible":{ text: "Сервис временно не доступен." },
        "whatBotCan":        { text: "Я умею:</br>Вызывать оператора</br>...В разработке..." },

        "unrekognized":      { text: "Не могу найти ответ" },

        "botCommands": {
            text: "Чем буду полезен?",
            buttons: [
                { name: "Список возможностей", value: "_showWhatBotCan" },
                { name: 'Вызвать оператора',   value: '_callManager'  }
            ]
        },
    }

    function createMessage(type: messageType, id: number): ChatMessage {
        let base: ChatMessage = {
            id: id,
            stamp: new Date().getTime(),
            from: {
                type: "bot",
                name: botName,
                userid: -1,
            },
            text: "DEBUG: Bot::createMessage: not text in object passed",
            buttons: []
        }

        let message: botMsgPreset = messages[type];

        return {
            ...base,
            ...message,
        };
    }

    return {
        createMessage,
        messages,
    }
})()

class ChatConnection {
    public onMessage: (msg: ChatMessage) => void                = () => {}
    public onDisconnect: (code: number, reason: Buffer) => void = () => {}
    public onManagerRequest: () => void                         = () => {}
    public chat: Chat;

    constructor(private socket: ws.WebSocket, chat: Chat) {
        this.chat = chat;

        this.socket.on("close", (c, r) => this.onDisconnect(c, r));
        this.socket.on("error", (e) => { console.log(e); this.onDisconnect(4000, new Buffer("Error" + e.message)) });
        this.socket.on("unexpected-response", (r) => console.log("Unexpected:", r));

        setTimeout(() => { this.ping() }, 5000);

        this.socket.on('message', async (data: ws.RawData) => {
            let req = JSON.parse(data.toString());
            switch (req.target) {
                case "message": {
                    if (req.payload.message) {
                        this.chat.appendHistory(req.payload.message);
                        this.onMessage(req.payload.message);
                    } else {
                        console.error("DEBUG: no message payload on targeting message");
                    }
                    break;
                }
                case "getOnline": {
                    let res = {
                        event: "onlineCount",
                        payload: { count: (await Database.managers.findMany({ online: true })).length }
                    }
                    this.socket.send(JSON.stringify(res));
                    break;
                }
                case "file": {
                    let res = await Database.files.getFile(req.payload.file.id);
                    if (res) {
                        let data = JSON.stringify({
                            event: "file",
                            payload: {
                                file: res,
                                config: req.payload.config,
                                data: fs.readFileSync(res.path, { encoding: 'base64' })
                            }
                        })
                        this.socket.send(data)
                    } else {
                        this.socket.send(JSON.stringify({
                            event: "error",
                            payload: {
                                code: 123,
                                text: "No image with id: " + req.payload.file.id
                            }
                        }))
                    }
                    break;
                }
                case "pong": {
                    setTimeout(() => this.ping(), 5000)
                    break;
                }
                default:
                    this.onDisconnect(1000, new Buffer("Unrekognized request"));
                    console.log("Unknown target request from chat: ", this.chat.hash, " :", req);
            }
        })
    }

    async deconstructor() {
        await this.destroy();
    }

    private ping() {
        this.socket.send(JSON.stringify({
            event: "ping",
            payload: {}
        }))
    }

    async destroy() {
        if (this.socket.readyState != ws.CLOSED || ws.CLOSING) {
            this.socket.close(4000, "Auto close");
        }
        if (this.chat.online) {
            this.chat.online = false;
            await this.chat.sync();
        }
    }

    async close() {
        let data = {
            event: "closed",
            payload: {}
        }
        this.socket.send(JSON.stringify(data));
        this.chat.managerId = null;
        this.chat.waitingManager = false;
        await this.chat.sync();
    }

    async leave() {
        this.chat.managerId = null;
        this.chat.waitingManager = true;
        await this.chat.sync();

        let msg = {
            event: "leaved",
            payload: {  }
        }
        this.socket.send(JSON.stringify(msg));
    }

    async accept(manager: ManagerSchema) {
        this.chat.managerId = manager.userId;
        this.chat.waitingManager = false;
        await this.chat.sync();
        let msg = {
            event: "accept",
            payload: { manager: manager } }; // TODO
        this.socket.send(JSON.stringify(msg))
    }

    async answer(message: ChatMessage) {
        let msg = {
            event: "message",
            payload: { message: message } }
        // TODO message.readed not used
        await this.chat.appendHistory(message, true);
        this.socket.send(JSON.stringify(msg))
        return true;
    }
}

export class ChatServer {
    private listener: ws.WebSocketServer;
    // private HttpServer: http.Server;
    // @ts-ignore
    private tunnel;
    private connections: Map<string, ChatConnection>;

    public errorHandler: (e: Error) => void                          = console.error;
    public closeHandler: () => void                                  = () => console.log("Chat server shutdowned");
    public onChatManagerRequest: (chat: Chat) => void                = () => {}
    /** @param waitReq true if chat page only reloading and customer issue not closed, false if chat member leave chat */
    public onChatClosed: (chat: Chat, waitReq: boolean) => void      = () => {}
    public onChatMessage: (chat: Chat, message: ChatMessage) => void = () => {}

    constructor() {
        this.connections = new Map<string, ChatConnection>();

        this.listener = new ws.WebSocketServer({ port: Config().server.port });

        this.listener.on('error', this.errorHandler.bind(this));
        this.listener.on('close', this.closeHandler.bind(this));
        this.listener.on('connection', this.connHandler.bind(this));
    }

    async start() {
        this.tunnel = await localtunnel({
            port: Config().server.port,
            subdomain: Config().server.subdomain,
        })

        this.tunnel.on("error", (e: any) => console.log("LT error:", e));

        console.log("Starting chat server on " + Config().server.port,
                    "\nTunneling to", this.tunnel.url)
    }

    async stop() {
        for (let [k,conn] of this.connections) {
            await conn.destroy();
            this.connections.delete(k)
        }
        this.listener.close();
        // this.HttpServer.close();
        this.tunnel.close();
        await Database.chats.updateMany(() => true, { managerId: null, waitingManager: false });
        await Database.chats.save();
        await Database.history.save();
    }

    private getJsonFromUrl(url: string): object {
        if(!url) url = location.href;
        var question = url.indexOf("?");
        var hash = url.indexOf("#");
        if(hash==-1 && question==-1) return {};
        if(hash==-1) hash = url.length;
        var query = question==-1 || hash==question+1 ? url.substring(hash) : 
            url.substring(question+1,hash);
        var result: object = {};
        query.split("&").forEach(function(part) {
            if(!part) return;
            part = part.split("+").join(" "); // replace every + with space, regexp-free version
            var eq = part.indexOf("=");
            var key = eq>-1 ? part.substr(0,eq) : part;
            var val = eq>-1 ? decodeURIComponent(part.substr(eq+1)) : "";
            var from = key.indexOf("[");
            // @ts-ignore
            if(from==-1) result[decodeURIComponent(key)] = val;
            else {
                var to = key.indexOf("]",from);
                var index = decodeURIComponent(key.substring(from+1,to));
                key = decodeURIComponent(key.substring(0,from));
            // @ts-ignore
                if(!result[key]) result[key] = [];
            // @ts-ignore
                if(!index) result[key].push(val);
            // @ts-ignore
                else result[key][index] = val;
            }
        });
        return result;
    }

    private async connHandler(socket: ws.WebSocket, req: http.IncomingMessage) {
        let reqData: any = this.getJsonFromUrl(String(req.url));

        console.log("Connection: ", reqData);

        let created = false;
        // will be overrided, only for ignore ts errors
        let chat: Chat = new Chat({ initiator: reqData.initiator ?? "Client", online: true, ip: req.connection.remoteAddress ?? "0.0.0.0" });
        if (reqData.hash || reqData.hash === "") {
            // @ts-ignore
            chat = await Chat.findOne({ hash: reqData.hash });
            if (!chat) {
                created = true;
                chat = new Chat({ initiator: reqData.initiator ?? "Client", online: true, ip: req.connection.remoteAddress ?? "0.0.0.0" });
                await chat.sync();
            }
        } else {
            socket.close(4000, "No params passed")
        }

        let response;

        if (created) {
            response = {
                event: "created",
                payload: { hash: chat.hash }
            }
        } else {
            let history = await chat.getHistory();
            chat.online = true;
            await chat.sync();
            let manager = null;
            if (chat.managerId) {
                manager = await Manager.findOne({ userId: chat.managerId })
            }
            response = {
                event: "restored",
                payload: {
                    chat: chat,
                    manager: manager,
                    history: history.map(m => m.message)
                }
            }
        }

        let connection = new ChatConnection(socket, chat);
        this.connections.set(chat.hash, connection);

        connection.onMessage = (msg) => { console.log("Message: ", msg); this.handleMessage(connection, msg) };
        connection.onManagerRequest = () => { console.log("Manager req"); this.onChatManagerRequest(connection.chat) };
        connection.onDisconnect = async (code) => {
            console.log("Disconnect", connection.chat, code);
            await this.onChatClosed(connection.chat, code === 4001); // TODO code
            let hist = await connection.chat.getHistory()
            if (!hist.length) {
                connection.chat.remove();
            }
            await connection.destroy();
            this.connections.delete(connection.chat.hash);
        }

        if (created) {
            // default first message seq
            connection.answer(Bot.createMessage("startup", 0));
            connection.answer(Bot.createMessage("whatBotCan", 1));
        }

        socket.send(JSON.stringify(response));
    }

    // type messageType = "startup" |
    //     "enterName" |
    //     "returnToManager" |
    //     "waitForManager" |
    //     "chatClosed" |
    //     'managerLeaved' |
    //     "historyTurnDelete" |
    //     "historyTurnSave" |
    //     "internalError" |
    //     "serviceNotAvalible" |
    //     "whatBotCan" |
    //     "unrekognized" |
    //     "botCommands"
    async handleMessage(conn: ChatConnection, msg: ChatMessage) {
        if (conn.chat.waitingManager) {
            // conn.answer(Bot.createMessage("waitForManager", (await conn.chat.lastMessageId()) + 1))
            conn.answer(Bot.createMessage("waitForManager", msg.id+1))
        } else {
            if (conn.chat.managerId) {
                this.onChatMessage(conn.chat, msg);
            } else {
                if (!( await conn.chat.getHistory() ).length) {
                    conn.answer(Bot.createMessage("startup", (await conn.chat.lastMessageId()) + 1))
                } else {
                    // BOT LOGIC TODO
                    conn.answer(Bot.createMessage("returnToManager", (await conn.chat.lastMessageId()) + 1))
                    conn.chat.waitingManager = true;
                    conn.chat.sync();
                    this.onChatManagerRequest(conn.chat);
                }
            }
        }
    }

    tunnelUrl(): URL {
        return this.tunnel.url;
    }

    enterChat(chatHash: string, manager: ManagerSchema): boolean {
        console.log(chatHash)
        if (this.connections.has(chatHash)) {
            let chat = this.connections.get(chatHash);
            if (chat) {
                if (!chat.chat!.managerId) {
                    chat.accept(manager);
                    return true;
                }
            }
        }
        return false;
    }

    async closeChat(chatHash: string) {
        let chat = this.connections.get(chatHash);
        if (chat) {
            if (chat.chat!.managerId) {
                chat.close();
                return true;
            }
        }
        return false;
    }

    async leaveChat(chatHash: string) {
        let chat = this.connections.get(chatHash);
        if (chat!.chat!.managerId) {
            await chat!.leave();
            return true;
        }
        return false;
    }

    async answerTo(chatHash: string, message: ChatMessage): Promise<boolean> {
        let chat = this.connections.get(chatHash);
        if (chat) {
            message.id = await chat.chat.lastMessageId() + 1;
            return await chat.answer(message);
        }
        return false;
    }
}
