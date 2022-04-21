import { TIMEOUT } from 'dns';
import * as tg from 'telegraf';
import express, { Express, Request, Response  } from 'express';
import * as http from 'http';
import { setTimeout } from 'timers';
import * as ws from 'ws';
import { Database, DatabaseBuffer, DatabaseChatEntry, DatabaseManagerEntry, DatabaseHistoryEntry } from './database.js';
import { EventEmitter } from 'events';
import * as evntss from 'events';
import { randomUUID } from 'crypto';
import { chatStatus } from './constants.js';

type ChatEvent = {
    message: (message: DatabaseHistoryEntry) => void;
}

interface IChat {
    on<U extends keyof ChatEvent>(event: U, listener: ChatEvent[U]): this;
    off<U extends keyof ChatEvent>(event: U, listener: ChatEvent[U]): this;
    emit<U extends keyof ChatEvent>(
        event: U,
        ...args: Parameters<ChatEvent[U]>
    ): boolean;
}

class Chat extends EventEmitter implements IChat {
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
        this.socket.send( JSON.stringify(msg))
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
    message: (message: DatabaseHistoryEntry) => void;
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
    private connections: Map<string, Chat>;
    private chats: DatabaseBuffer<DatabaseChatEntry>;
    private chatsHistory: DatabaseBuffer<DatabaseHistoryEntry>;

    constructor() {
        super();
        this.chats = new DatabaseBuffer("Chats", [ "hash", "managerId" ], "hash", false);
        this.chatsHistory = new DatabaseBuffer("History", [ "id", "chatHash", "from", "creator", "time", "text", "handled" ], "id");
        this.connections = new Map<string, Chat>();

        let app = express();
        let server = new http.Server(app);
        this.listener = new ws.WebSocketServer({ server });

        this.listener.on('error', (e) => console.error(e));
        this.listener.on('close', () => console.log("closing"));
        this.listener.on('connection', (socket, request) => {
            console.log("New connections");
            // prepare
            socket.once('message', async (msg: ws.RawData) => {
                console.log("New connections messaging: ", msg.toString());
                let prepare = async (): Promise<{ hash: string, restored: boolean, connected?: number | null } | undefined> => {
                    let json: any;

                    try {
                        json = JSON.parse(msg.toString());
                    } catch (e) {
                        socket.close(123, "Parse error");
                        return undefined;
                    }

                    if (json.hash) { // try restore
                        let found = await this.chats.get(json.hash).catch((e) => console.log(""));
                        if (!found) { // chat hash not exits
                            let l_entry: DatabaseChatEntry = {
                                hash: randomUUID(),
                                managerId: null
                            };
                            this.chats.add(l_entry.hash, l_entry)
                            return { hash: l_entry.hash, restored: false };
                        } else { // restore
                            return { hash: json.hash, connected: found.managerId, restored: true };
                        }
                    } else { // new client
                        let l_entry: DatabaseChatEntry = {
                            hash: randomUUID(),
                            managerId: null
                        };
                        this.chats.add(l_entry.hash, l_entry)
                        return { hash: l_entry.hash, restored: false };
                    }
                }

                let settings = await prepare();
                if (settings) {
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
                    let chat = new Chat(socket);
                    this.connections.set(settings.hash, chat);
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
                        this.emit('endChat', settings!.hash);
                    });
                }
            })
        })

        server.listen(7900, () => {
            console.log("Starting relay server")
        });
    }

    acceptChat(chatHash: string, managerId: number, name: string): boolean {
        if (this.connections.has(chatHash)) {
            let chat = this.connections.get(chatHash);
            if (!chat!.linked()) {
                this.chats.update(chatHash, { managerId: managerId })
                chat!.accept(managerId, name);
                return true;
            }
        }
        return false;
    }

    closeChat(chatHash: string) {

    }

    leaveChat(chatHash: string) {

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
