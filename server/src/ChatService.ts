import { TIMEOUT } from 'dns';
import * as tg from 'telegraf';
import express, { Express, Request, Response  } from 'express';
import * as http from 'http';
import { setTimeout } from 'timers';
import * as ws from 'ws';
import { Database, DatabaseBuffer, DatabaseChatEntry, DatabaseManagerEntry } from './database.js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { chatStatus } from './constants.js';

class ChatHistory extends Array<ChatMessage> {
    constructor() {
        super();
    }
}

class Chat extends EventEmitter {
    private history: ChatHistory;
    private status: chatStatus;

    constructor(private socket: ws.WebSocket) {
        super();
        this.history = new ChatHistory();
        this.status = chatStatus.pending;

        this.socket.on('close', (code, reason) => {
            this.status = chatStatus.closed;
            this.emit("destroy");
        });

        this.socket.on('message', (data: ws.RawData) => {
            this.emit('message', data.toString())
        })
    }

    deconstructor() {
        this.socket.close();
    }

    get linked() {
        return this.status == chatStatus.active;
    }

    close() {
        this.status = chatStatus.closed;
        this.socket.close(321, "Chat completed by manager");
        this.emit('destroy');
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

    answer(message: ChatMessage) {
        if (this.status = chatStatus.active) {
            this.socket.send(
                JSON.stringify(
                    {
                        event: "answer",
                        data: {
                            message: message
                        }
                    }
                )
            )
        } else {
            console.error("DBUG: trying answer to not active chat");
        }
    }
}

export class ChatServer extends EventEmitter {
    private listener: ws.WebSocketServer;
    private connections: Map<string, Chat>;
    private chats: DatabaseBuffer<string, DatabaseChatEntry>;

    constructor() {
        super();
        this.chats = new DatabaseBuffer({
            insertQuery: "INSERT INTO Chats (hash) VALUES(?)",
            deleteQuery: "DELETE FROM Chats WHERE hash=?",
            selectQuery: "SELECT * FROM Chats WHERE hash=?",
            updateQuery: "UPDATE Chats SET hash=?, managerId=? WHERE hash=?"
        }, "hash", false);
        this.connections = new Map<string, Chat>();

        let app = express();
        let server = new http.Server(app);
        this.listener = new ws.WebSocketServer({ server });

        this.listener.on('error', (e) => console.error(e));
        this.listener.on('connection', (socket, request) => {
            console.log("New connections");
            // prepare
            socket.once('message', async (msg: string) => {
                console.log("New connections messaging: ", msg.toString);
                let prepare = async (): Promise<{ hash: string, restored: boolean, connected?: number | null } | undefined> => {
                    let json: any;

                    try {
                        json = JSON.parse(msg.toString());
                    } catch (e) {
                        socket.close(123, "Parse error");
                        return undefined;
                    }

                    if (json.hash) { // try restore
                        let found = await this.chats.get(json.hash);
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
                            data: {
                                manager: "JOSDF"
                            }
                        }));
                        this.emit('restoredChat', settings.hash);
                    } else {
                        socket.send(JSON.stringify({
                            event: "created",
                            data: { hash: settings.hash }
                        }));
                        this.emit('newChat', settings.hash);
                    }
                    let chat = new Chat(socket);
                    this.connections.set(settings.hash, chat);
                    chat.on('message', (text: string) => {
                        // @ts-ignore
                        this.emit('message', settings.hash, text);
                    })
                    chat.on('destroy', () => {
                        // @ts-ignore
                        this.connections.delete(settings.hash);
                        // @ts-ignore
                        this.emit('chatEnd', settings.hash);
                    });
                }
            })
        })

        server.listen(7900, () => {
            console.log("Starting relay server")
        });
    }

    acceptChat(chatHash: string, manager: DatabaseManagerEntry): boolean {
        if (this.connections.has(chatHash)) {
            let chat = this.connections.get(chatHash);
            // @ts-ignore
            if (chat.linked) {

            }
            // @ts-ignore
            chat.accept(manager);
            return true;
        }
        return false;
    }

    closeChat(chatHash: string) {

    }

    leaveChat(chatHash: string) {

    }

    answerTo(chatHash: string, message: ChatMessage): boolean {
        if (this.connections.has(chatHash)) {
            // @ts-ignore
            this.connections.get(chatHash).answer(message);
            return true;
        }
        return false;
    }
}
