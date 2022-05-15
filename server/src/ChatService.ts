import * as fs from 'fs'
import * as http from 'http'
import * as ws from 'ws'
import fuzzy from 'fuzzy'
import { Database, Chat, Manager } from './database.js'
import { ChatStage } from './Schemas/Chat.js'
import { ManagerSchema } from './Schemas/Manager'
import { Config } from './Config.js'
import { ChatMessage } from './Schemas/ChatMessage'
import localtunnel from 'localtunnel'

import { EventMap, EventEmitter } from './EventEmmiter.js'

let Bot = (() => {
    const botName = "Tech-bot";

    // TODO use Pick from ChatMessage
    type botMsgPreset = { text: string, buttons?: { name: string, value: string }[] }

    type messageType = "startup" |
        "enterName" |
        "whoIm" |
        "returnToManager" |
        "askForCallManager" |
        "callManagerByCommand" |
        "howCanIBeHelpfull" |
        "waitForManager" |
        "chatClosed" |
        'managerLeaved' |
        "historyTurnDelete" |
        "historyTurnSave" |
        "internalError" |
        "serviceNotAvalible" |
        "whatBotCan" |
        "unrekognized" |
        "botCommands" |
        "faq"

    const messages: Record<messageType, botMsgPreset> = {
        "startup":           { text: 'Я - ' + botName },
        "whoIm":             { text: "Я - " + botName },
        "enterName":         { text: "Как к вам обращаться?" },
        "faq":               { text: "" },
        "returnToManager":   { text: "Тут я бессилен, вызываю оператора." },
        "callManagerByCommand": { text: "Вызываю оператора." },
        "askForCallManager": { text: "Не могу найти ответ. Нужна помощь оператора?" },
        "waitForManager":    { text: "Пожалуйста, подождите, вам скоро ответят." },
        "howCanIBeHelpfull": { text: "Чем вам буду полезен?" },
        "chatClosed":        { text: "Чат закрыт, надеюсь мы помогли вам." },
        'managerLeaved':     { text: "Оператор вышел из чата, ищем вам другого." },
        "historyTurnDelete": { text: "Сообщения больше не будут сохраняться в историю" },
        "historyTurnSave":   { text: "Сообщения будут сохраняться в историю" },
        "internalError":     { text: "Ой-ой. Что то пошло не так, пожалуйста, презагрузите страницу." },
        "serviceNotAvalible":{ text: "Сервис временно не доступен." },
        "whatBotCan":        { text: 'Я умею:</br>Отвечать на несложные вопросы</br>Вызывать оператора' },

        "unrekognized":      { text: "Не могу найти ответ" },

        "botCommands": {
            text: "Чем буду полезен?",
            buttons: [
                { name: "Список возможностей", value: "_showWhatBotCan" },
                { name: 'Вызвать оператора',   value: '_callManager'  }
            ]
        },
    }

    function createMessage(type: messageType, id: number, ...arg: string[]): ChatMessage {
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

        // arg MUST contain string array
        if (type == "faq") {
            if (arg.length == 1) {
                message.text = arg[0];
            } else {
                message.text = "Вы хотели узнать что то из этого списка?</br><ul>"
                while (arg.length) {
                    message.text += "<li>" + arg[0] + "</li>";
                    arg.splice(0, 1);
                }
                message.text += "</ul>Если да - введите запрос более конкретно"
            }
        } else {
            while (arg && arg.length) {
                message.text.replace("%%", arg[0]);
                arg.splice(0, 1);
            }
        }

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
    public preCallSeq: boolean = false;

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
                        /* await */ this.chat.appendHistory(req.payload.message);
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
                    // deligated disconnect
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
            await this.chat.setOnline(false);
        }
    }

    async close() {
        let data = {
            event: "closed",
            payload: {}
        }
        this.socket.send(JSON.stringify(data));
        await this.chat.setWaitingStatus(false);
        await this.chat.unlinkManager();
    }

    async leave() {
        await this.chat.unlinkManager();
        await this.chat.setWaitingStatus(true);

        let msg = {
            event: "leaved",
            payload: {  }
        }
        this.socket.send(JSON.stringify(msg));
    }

    async accept(manager: ManagerSchema) {
        await this.chat.setWaitingStatus(false);
        await this.chat.linkManager(manager.userId);
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
        this.socket.send(JSON.stringify(msg))
        await this.chat.appendHistory(message, true);
    }
}

interface cs_em extends EventMap {
    'error': Error;
    'close': void;
    'managerRequest': Chat;
    'chatClosed': { chat: Chat, waitReq: boolean };
    'chatMessage': { chat: Chat, message: ChatMessage };
}

export class ChatServer extends EventEmitter<cs_em> {
    private listener: ws.WebSocketServer;
    private tunnel?: localtunnel.Tunnel;
    private connections: Map<string, ChatConnection>;

    // remove
    private errorHandler: (e: Error) => void = console.error;
    private closeHandler: ()         => void = () => console.log("Chat server shutdowned");

    constructor() {
        super();
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

        this.tunnel.setMaxListeners(10);

        this.tunnel.on("error", (e: any) => {
            throw "LT error:" + e;
        });

        if (this.tunnel.url && this.tunnel.url == "https://" + Config().server.subdomain + ".loca.lt") {
            console.log("Chat server running on localhost:" + Config().server.port);
            console.log("Chat serivce tunneling to", this.tunnel.url)
        } else {
            throw "subdomain: " + Config().server.subdomain + " is busy"
        }
    }

    async stop() {
        for (let [k,conn] of this.connections) {
            await conn.destroy();
            this.connections.delete(k)
        }
        this.listener.close();
        this.tunnel!.close();
        if (!Config().server.database.saveChatHistory) {
            await Database.history.drop();
            await Database.chats.drop();
        } else {
            await Database.chats.updateMany((c) => c.managerId != null || c.waitingManager == true,
                { managerId: null, waitingManager: false, stage: ChatStage.smartHandling });
        }
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

        let created = false;
        // will be overrided, only for ignore ts errors
        let chat: Chat = new Chat({ initiator: reqData.initiator ?? "Client", online: true, ip: req.connection.remoteAddress ?? "0.0.0.0" });
        if (reqData.hash || reqData.hash === "") {
            let l_chat = await Chat.findOne({ hash: reqData.hash });
            if (!l_chat) {
                created = true;
                chat = new Chat({ initiator: reqData.initiator ?? "Client", online: true, ip: req.connection.remoteAddress ?? "0.0.0.0" });
                await chat.sync();
            } else {
                chat = l_chat;
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
            await chat.setOnline(true);
            let history = await chat.getHistory();
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

        connection.onMessage = (msg) => { this.handleMessage(connection, msg) };
        connection.onManagerRequest = () => { this.emit('managerRequest', connection.chat) };
        connection.onDisconnect = async (code) => {
            this.emit('chatClosed', { chat: connection.chat, waitReq: code === 4001});
            let hist = await connection.chat.getHistory()
            if (!hist.length) {
                connection.chat.remove();
            } else {
                if (connection.chat.stage === ChatStage.managerLink && code !== 4001) {
                    await connection.chat.setStage(ChatStage.smartHandling);
                }
            }
            await connection.destroy();
            this.connections.delete(connection.chat.hash);
        }

        socket.send(JSON.stringify(response));

        if (created) {
            // default first message seq
            setTimeout(async () => {
                await connection.chat.setStage(ChatStage.enteringName);
                connection.answer(Bot.createMessage("startup", 0));
                connection.answer(Bot.createMessage("enterName", 1));
            }, 500)
        }
    }

    // TODO make it SOLID
    async handleMessage(conn: ChatConnection, msg: ChatMessage) {
        if (conn.chat.waitingManager) {
            conn.answer(Bot.createMessage("waitForManager", msg.id+1))
        } else {
            switch (conn.chat.stage) {
                case ChatStage.startup:
                    await conn.chat.setStage(ChatStage.enteringName);
                    conn.answer(Bot.createMessage("startup", 0));
                    conn.answer(Bot.createMessage("enterName", 1));
                    break;
                case ChatStage.enteringName:
                    if (msg.text.length) {
                        conn.chat.setInitiatorName(msg.text);
                        await conn.chat.setStage(ChatStage.smartHandling);
                        conn.answer(Bot.createMessage('whatBotCan', msg.id+1));
                    }
                    break;
                case ChatStage.managerLink: // redirect to manager chat
                    this.emit("chatMessage", { chat: conn.chat, message: msg});
                    break;
                case ChatStage.smartHandling: // faq answer ... other bot operations
                    let reqManager = async () => {
                        await conn.chat.setWaitingStatus(true);
                        this.emit('managerRequest', conn.chat);
                    }
                    let fuzzyMatchScore = (s: Map<string, { input: string, minScore: number }>): boolean => {
                        let ret = false;
                        s.forEach((e, key) => {
                            const match = fuzzy.match(key, e.input, { caseSensitive: false });
                            if (match && match.score > e.minScore) {
                                ret = true;
                                // break;
                            }
                        })
                        return ret;
                    }
                    if (conn.preCallSeq) { // sub stage
                        if (fuzzyMatchScore(new Map([
                            [ "да",        { input: msg.text, minScore: 80 } ],
                            [ "конечно",   { input: msg.text, minScore: 80 } ],
                            [ "да конечно",{ input: msg.text, minScore: 80 } ],
                            [ "подключай", { input: msg.text, minScore: 60 } ],
                            [ "нужен",     { input: msg.text, minScore: 50 } ],
                           ])) ) {
                            conn.answer(Bot.createMessage("callManagerByCommand", msg.id+1))
                            await reqManager();
                        } else {
                            conn.answer(Bot.createMessage("howCanIBeHelpfull", msg.id+1));
                        }
                        conn.preCallSeq = false;
                    } else { // main stage
                        if (fuzzyMatchScore(new Map([
                            [ "Вызови оператора", { input: msg.text, minScore: 65 } ],
                            [ "Нужна реальная помощь", { input: msg.text, minScore: 60 } ],
                            [ "человека бы", { input: msg.text, minScore: 60 } ],
                            [ "Вызвать менеджера", { input: msg.text, minScore: 60 } ],
                        ])))
                        {
                            conn.answer(Bot.createMessage("callManagerByCommand", msg.id+1))
                            await reqManager();
                        }
                        else if (fuzzyMatchScore(new Map([
                            [ "Что ты умеешь", { input: msg.text, minScore: 65 } ],
                            [ "список возможностей", { input: msg.text, minScore: 60 } ],
                            [ "команды", { input: msg.text, minScore: 50 } ],
                        ])))
                        {
                            conn.answer(Bot.createMessage("whatBotCan", msg.id+1));
                        }
                        else if (fuzzyMatchScore(new Map([
                            [ "Кто ты", { input: msg.text, minScore: 40 } ]
                        ])))
                        {
                            conn.answer(Bot.createMessage("whoIm", msg.id+1));
                        }
                        else // FAQ search
                        {
                            let faqAnswer = Database.faq.search(msg.text);
                            if (faqAnswer.length > 0) {
                                conn.answer(Bot.createMessage("faq", msg.id+1, ...faqAnswer))
                            } else {
                                conn.answer(Bot.createMessage("askForCallManager", msg.id+1));
                                conn.preCallSeq = true;
                            }
                        }
                    }
                    break;
            }
        }
    }

    tunnelUrl(): string {
        return this.tunnel!.url;
    }

    enterChat(chatHash: string, manager: ManagerSchema): boolean {
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
        if (chat && chat.chat.managerId) {
            await chat.leave();
            return true;
        }
        return false;
    }

    async answerTo(chatHash: string, message: ChatMessage): Promise<boolean> {
        let chat = this.connections.get(chatHash);
        if (chat) {
            // override
            message.id = await chat.chat.lastMessageId() + 1;
            await chat.answer(message);
            return true;
        }
        return false;
    }
}
