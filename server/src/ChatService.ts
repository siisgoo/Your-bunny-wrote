// @ts-ignore
import express, { Request, Response  } from 'express'
import * as http from 'http'
import * as ws from 'ws'
import { Database, Chat, Manager } from './database.js'
import { ManagerSchema } from './Schemas/Manager'
import { Config } from './Config.js'
import { ChatMessage } from './Schemas/ChatMessage'
import localtunnel from 'localtunnel'

// import { Response as ChatResponse } from './Events.js';

let Bot = (() => {
    const botName = "Bot-Name";

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
                name: botName
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

        this.socket.on("close", this.onDisconnect);

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
                default:
                    console.log("Unknown target request from chat: ", this.chat.hash, " :", req);
            }
        })
    }

    async deconstructor() {
        await this.destroy();
    }

    async destroy() {
        if (this.socket.readyState != ws.CLOSED || ws.CLOSING) {
            this.socket.close(0, "Auto close");
        }
        this.chat.online = false;
        await this.chat.sync();
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
    private HttpServer: http.Server;
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

        let app = express();
        this.HttpServer = new http.Server(app);

        this.listener = new ws.WebSocketServer({ server: this.HttpServer });

        this.listener.on('error', this.errorHandler.bind(this));
        this.listener.on('close', this.closeHandler.bind(this));
        this.listener.on('connection', this.connHandler.bind(this));
    }

    async start() {
        this.tunnel = await localtunnel({
            port: Config().server.port,
            subdomain: Config().server.subdomain,
        })

        this.HttpServer.listen(Config().server.port, () => {
            console.log("Starting chat server on " + Config().server.port,
                        "\n Tunneling to", this.tunnel.url)
        })

        // this.HttpServer.on("upgrade", (req, socket, head) => {

        // })
    }

    async stop() {
        for (let [k,conn] of this.connections) {
            await conn.destroy();
            this.connections.delete(k)
        }
        this.listener.close();
        this.HttpServer.close();
        this.tunnel.close();
        await Database.chats.updateMany(() => true, { managerId: null, waitingManager: false });
        await Database.chats.save();
        await Database.history.save();
    }

    private connHandler(socket: ws.WebSocket) {
            // prepare TODO set timeout for get first message
            socket.once('message', async (msg: ws.RawData) => {
                let json = JSON.parse(msg.toString());

                // assert type && disconn

                let created = false;
                let chat = await Chat.findOne({ hash: json.hash });
                if (!chat) {
                    created = true;
                    chat = new Chat({ initiator: json.initiator, online: true });
                    await chat.sync();
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

                connection.onMessage = (msg) => this.handleMessage(connection, msg);
                connection.onManagerRequest = () => this.onChatManagerRequest(connection.chat);
                connection.onDisconnect = async (code) => {
                    // @ts-ignore
                    this.onChatClosed(chat, code === 0); // TODO code
                    await connection.destroy();
                    this.connections.delete(chat!.hash);
                }

                if (created) {
                    // default first message seq
                    connection.answer(Bot.createMessage("startup", 0));
                }

                socket.send(JSON.stringify(response));
            })
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
            return await chat.answer(message);
        }
        return false;
    }
}
