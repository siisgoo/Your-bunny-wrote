// @ts-ignore
import express, { Request, Response  } from 'express'
import * as http from 'http'
import * as ws from 'ws'
import { Database, Chat, ChatSchema, Manager } from './database.js'
import { ManagerSchema } from './Schemas/Manager'
import { Config } from './Config.js'
import { ChatMessage } from './Schemas/ChatMessage'

// import { Response as ChatResponse } from './Events.js';

class ChatConnection extends Chat {
    public onMessage: (msg: ChatMessage) => void                = () => {}
    public onDisconnect: (code: number, reason: Buffer) => void = () => {}
    public onManagerRequest: () => void                         = () => {}

    constructor(private socket: ws.WebSocket, chat: ChatSchema) {
        super(chat);

        this.socket.on("close", this.onDisconnect);

        this.socket.on('message', async (data: ws.RawData) => {
            let req = JSON.parse(data.toString());
            switch (req.target) {
                case "message": {
                    if (req.payload.message) {
                        this.onMessage(req.payload.message);
                    } else {
                        console.error("DEBUG: no message payload on targeting message");
                    }
                    break;
                }
                case "managerRequest": {
                    this.onManagerRequest();
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
                    console.log("Unknown target request from chat: ", this.hash, " :", req.target);
            }
        })
    }

    // private async sync() {
    //     return super.sync();
    // }

    // private async remove() {
    //     return super.remove();
    // }

    deconstructor() {
    }

    async close() {
        this.socket.close(321, "Chat close by manager");
        this.managerId = null;
        await this.sync();
    }

    async accept(manager: ManagerSchema) {
        this.managerId = manager.userId;
        await this.sync();
        let msg = {
            event: "accept",
            payload: { manager: manager } }; // TODO
        this.socket.send(JSON.stringify(msg))
    }

    async answer(message: ChatMessage) {
        if (this.managerId) {
            let msg = {
                event: "answer",
                payload: { message: message } }
            // TODO message.readed not used
            await this.appendHistory(message, true);
            this.socket.send(JSON.stringify(msg))
            return true;
        } else {
            return false
        }
    }
}

export class ChatServer {
    private listener: ws.WebSocketServer;
    private HttpServer: http.Server;
    private connections: Map<string, ChatConnection>;

    public errorHandler: (e: Error) => void                          = (e) => console.log(e);
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
        this.HttpServer.listen(Config().server.port, () => {
            console.log("Starting relay server")
        });

        // this.HttpServer.on("upgrade", (req, socket, head) => {

        // })
    }

    async stop() {
        for await (let [,conn] of this.connections) {
            await conn.close();
        }
        await Database.chats.updateMany(() => true, { managerId: null });
        await Database.chats.save();
        await Database.history.save();
    }

    private connHandler(socket: ws.WebSocket) {
            // prepare TODO set timeout for get first message
            socket.once('message', async (msg: ws.RawData) => {
                let json = JSON.parse(msg.toString());

                if (!json.initiator) {
                    // assert
                }

                // check chat for existance in database
                let chat = await Chat.findOne({ hash: json.hash });
                if (!chat) {
                    chat = new Chat({ initiator: json.initiator });
                    await chat.sync();
                }

                let response;

                if (chat.managerId) {
                    response = {
                        event: "restored",
                        payload: { // avoiding ts warnings, manager must exists if db is not currupted
                            manager: <ManagerSchema>( await Manager.findOne({ userId: chat.managerId }) )
                        }
                    }
                } else {
                    response = {
                        event: "created",
                        payload: { hash: chat.hash }
                    };
                }

                socket.send(JSON.stringify(response));

                let connection = new ChatConnection(socket, chat);
                this.connections.set(chat.hash, connection);

                connection.onMessage = (msg) => this.onChatMessage(connection, msg);
                connection.onManagerRequest = () => this.onChatManagerRequest(connection);
                connection.onDisconnect = (code) => {
                    // @ts-ignore
                    this.onChatClosed(chat, code === 3213); // TODO code
                    this.connections.delete(chat!.hash);
                }
            })
    }

    enterChat(chatHash: string, manager: ManagerSchema): boolean {
        if (this.connections.has(chatHash)) {
            let chat = this.connections.get(chatHash);
            if (!chat!.managerId) {
                Database.chats.updateOne({ hash: chatHash }, { managerId: manager.userId })
                chat!.accept(manager);
                return true;
            }
        }
        return false;
    }

    async closeChat(chatHash: string) {
        let chat = this.connections.get(chatHash);
        if (chat!.managerId) {
            chat!.close();
            return true;
        }
        return false;
    }

    async leaveChat(chatHash: string) {
        let chat = this.connections.get(chatHash);
        if (chat!.managerId) {
            // await chat.leave();
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
