import express, { Express, Request, Response  } from 'express';
import * as http from 'http';
// import { setTimeout } from 'timers';
import * as ws from 'ws';
import { Database, Chat } from './database.js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

type ChatConnectionEvent = {
    message: (message: ChatMessage) => void;
}

interface IChatConnection {
    on<U extends keyof ChatConnectionEvent>(event: U, listener: ChatConnectionEvent[U]): this;
    off<U extends keyof ChatConnectionEvent>(event: U, listener: ChatConnectionEvent[U]): this;
    emit<U extends keyof ChatConnectionEvent>(event: U, ...args: Parameters<ChatConnectionEvent[U]>): boolean;
}

class ChatConnection extends EventEmitter implements IChatConnection {
    private managerId?: number;

    constructor(private socket: ws.WebSocket) {
        super();

        this.socket.on('message', (data: ws.RawData) => {
            this.emit('message', JSON.parse(data.toString()));
        })
    }

    deconstructor() {
        this.socket.close();
    }

    linked() {
        return this.managerId;
    }

    close() {
        this.managerId = undefined;
        this.socket.close(321, "Chat completed by manager");
    }

    accept(managerId: number, name: string) {
        this.managerId = managerId;
        let msg: ServerMessage = {
                    event: "accepted",
                    payload: {
                        manager: name
                    }
                };
        this.socket.send(JSON.stringify(msg))
    }

    answer(message: ChatMessage) {
        if (this.linked()) {
            let msg: ServerMessage = {
                        event: "answer",
                        payload: {
                            message: message
                        }
                    }
            this.socket.send(JSON.stringify(msg))
        } else {
            console.error("DBUG: trying answer to not active chat");
        }
    }
}

type ChatServerEvent = {
    message: (message: ChatMessage) => void;
    restoredChat: (hash: string) => void;
    newChat: (hash: string) => void;
    endChat: (hash: string, wasLinked: boolean) => void;
}

interface IChatServer {
    on<U extends keyof ChatServerEvent>(event: U, listener: ChatServerEvent[U]): this;
    off<U extends keyof ChatServerEvent>(event: U, listener: ChatServerEvent[U]): this;
    emit<U extends keyof ChatServerEvent>(
        event: U,
        ...args: Parameters<ChatServerEvent[U]>
    ): boolean;
}

export class ChatServer extends EventEmitter implements IChatServer {
    private listener: ws.WebSocketServer;
    private HttpServer: http.Server;
    private connections: Map<string, ChatConnection>;

    constructor() {
        super();
        this.connections = new Map<string, ChatConnection>();

        let app = express();
        this.HttpServer = new http.Server(app);

        this.listener = new ws.WebSocketServer();

        this.listener.on('error', (e) => console.error(e));
        this.listener.on('close', () => console.log("closing"));

        this.listener.on('connection', (socket, request) => {
            console.log("New connections");
            // prepare TODO set timeout for get first message
            socket.once('message', async (msg: ws.RawData) => {
                console.log("New connections messaging: ", msg.toString());

                let json = JSON.parse(msg.toString());

                if (json.hash) { // try restore
                    let found = await this.chats.get(json.hash).catch((e) => console.log(""));
                    if (!found) { // chat hash not exits
                    } else { // restore
                    }
                } else { // new client
                }

                if (settings.restored) {
                    // TODO
                    socket.send(JSON.stringify({
                        event: "restored",
                        payload: {
                            manager: "JOSDF"
                        }
                    }));
                    this.emit('restoredChat', settings.hash);
                } else {
                    socket.send(JSON.stringify({
                        event: "created",
                        payload: { hash: settings.hash }
                    }));
                    this.emit('newChat', settings.hash);
                }
                let connection = new ChatConnection(socket);
                this.connections.set(settings.hash, connection);
                chat.on('message', (ev) => {
                    if (ev.event == "message") {
                        let ev_msg: ChatMessage = ev.data.message;
                        if (ev_msg) {
                            let msg: DatabaseHistoryEntry = {
                                id: ev_msg.id,
                                chatHash: settings!.hash,
                                from: ev_msg.from,
                                creator: ev_msg.creator,
                                time: ev_msg.time,
                                text: ev_msg.text,
                                handled: Number(Boolean(chat.linked()))
                            };
                            this.chatsHistory.add(ev.data.message.id, msg);
                            this.emit('message', settings!.hash, chat.linked(), msg);
                        }
                    } else {
                        console.log("Unhenled message from chat: ", ev);
                    }
                })
                socket.on('close', (code, reason) => {
                    this.connections.delete(settings!.hash);
                    this.emit('endChat', settings!.hash, chat.linked());
                });

            })
        })

    }

    async start() {
        this.HttpServer.listen(7900, () => {
            console.log("Starting relay server")
        });
    }

    async stop() {
        await Database.chats.updateMany(() => true, { managerId: null });
        await Database.chats.save();
    }

    acceptChat(chatHash: string, managerId: number, name: string): boolean {
        if (this.connections.has(chatHash)) {
            let chat = this.connections.get(chatHash);
            if (!chat!.linked()) {
                Database.chats.updateOne({ hash: chatHash }, { managerId: managerId })
                chat!.accept(managerId, name);
                return true;
            }
        }
        return false;
    }

    closeChat(chatHash: string) {
        let chat = this.connections.get(chatHash);
        if (chat!.linked()) {
            Database.chats.updateOne({ hash: chatHash }, { managerId: null });
            chat!.close();
            return true;
        }
        return false;
    }

    leaveChat(chatHash: string) {
        let chat = this.connections.get(chatHash);
        if (chat!.linked()) {
            return true;
        }
        return false;
    }

    answerTo(chatHash: string, message: ChatMessage): boolean {
        let chat = this.connections.get(chatHash);
        if (chat) {
            if (chat.linked()) {
                chat.answer(message);
                return true;
            }
        }
        return false;
    }
}
