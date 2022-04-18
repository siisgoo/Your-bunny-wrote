import { TIMEOUT } from 'dns';
import * as tg from 'telegraf';
import express, { Express, Request, Response  } from 'express';
import * as http from 'http';
import { setTimeout } from 'timers';
import * as ws from 'ws';
import { Database, DatabaseBuffer, DatabaseEntry } from './database.js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { chatStatus } from './constants.js';

interface DatabaseChatEntry extends DatabaseEntry {
    hash: string,
    managerId: number | undefined,
}

class ChatsBuffer extends DatabaseBuffer<DatabaseChatEntry> {
    constructor() {
        super();
    }

    get(arg: { hash?: string, id?: number, active?: boolean }): DatabaseEntry | undefined {
        for (let v of this.list) {
            if (v.hash === arg.hash || v.id == arg.id) {
                if (arg.active != undefined) {
                    if (v.managerId != undefined) {
                        return v;
                    }
                } else {
                    return v;
                }
            }
        }

        return undefined;
    }

    async sync(): Promise<void> {

        super.sync(); // emits
    }
}

class ChatHistory extends Array<ChatMessage> {
    constructor() {
        super();
    }
}

class Chat extends EventEmitter {
    private history: ChatHistory;
    private hash: string | undefined;
    private status: chatStatus;

    constructor(private socket: ws.WebSocket) {
        super();
        this.history = new ChatHistory();
        this.status = chatStatus.pending;

        this.socket.once('message', (msg) => {
            let json: any;
            try {
                let json = JSON.parse(msg.toString());
            } catch (e) {
                this.socket.close(123, "Parse error");
            }
            let create = () => {
                this.hash = randomUUID();
                this.socket.send(JSON.stringify({
                    event: "created",
                    data: { hash: this.hash }
                }));
            }
            let restore = (name: string) => {
                this.hash = json.hash;
                this.socket.send(JSON.stringify({
                    event: "restored",
                    data: {
                        manager: name
                    }
                }));
            }
            if (json.hash) { // try restore
                // db.get("SELECT COUNT(*), managerId as count FROM Chats WHERE hash=?", json.hash, (err: Error, row) => {
                //     if (err) {
                //         create();
                //     } else {
                //         if (row.count > 0) {
                //             db.get("SELECT * FROM Managers WHERE id=?", row.managrId, (err: Error, row) => {
                //                 if (row.tgUserId) {
                                    
                //                 }
                //             });
                //         }
                //     }
                // });
            } else { // new client
                create();
            }
        });

        this.socket.on('close', (code, reason) => {
            this.status = chatStatus.closed;
            this.emit("destroy");
        });
    }

    deconstructor() {
        this.socket.close();
    }

    get Hash() {
        return this.hash;
    }

    complete() {
        this.status = chatStatus.closed;
        this.socket.close(321, "Chat completed by manager");
    }

    accept(name: string) {
        this.status = chatStatus.active;
        this.socket.send(
            JSON.stringify(
                {
                    event: "accepted",
                    data: {
                        manager: name
                    }
                }
            )
        )
    }

    answer(text: string) {
        if (this.status = chatStatus.active) {
            this.socket.send(
                JSON.stringify(
                    {
                        event: "answer",
                        data: {
                            text: text
                        }
                    }
                )
            )
        } else {
            console.error("DBUG: trying answer to not active chat");
        }
    }
}

class ChatServer {
    private listener: ws.WebSocketServer;
    private noForgotTimeout: number;
    private connections: Set<Chat>;
    private dbBuffer: ChatsBuffer;

    constructor() {
        this.dbBuffer = new ChatsBuffer();
        this.connections = new Set<Chat>();
        this.noForgotTimeout = 5 * 60 * 1000; // 5 min

        let app = express();
        let server = new http.Server(app);
        this.listener = new ws.WebSocketServer({ server });

        this.listener.on('error', (e) => console.error(e));
        this.listener.on('connection', (socket, request) => {
            let chat = new Chat(socket);
            this.connections.add(chat);
            chat.on('destroy', () => {
                this.connections.delete(chat);
            });
        });

        server.listen(7900, () => {
            console.log("Starting relay server")
        });
    }

    async dispoce() {

    }
}
