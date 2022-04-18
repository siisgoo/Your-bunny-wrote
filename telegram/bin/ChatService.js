import express from 'express';
import * as http from 'http';
import * as ws from 'ws';
import { Database, DatabaseBuffer } from './database.js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { chatStatus } from './constants.js';
class ChatsBuffer extends DatabaseBuffer {
    constructor() {
        super();
    }
    get(arg) {
        this.list.forEach(v => {
            if (v.hash === arg.hash || v.id == arg.id) {
                return v;
            }
        });
        return undefined;
    }
    async sync() {
        super.sync(); // emits
    }
}
class ChatHistory extends Array {
    constructor() {
        super();
    }
}
class Chat extends EventEmitter {
    socket;
    noForgot;
    noForgotTimer;
    history;
    hash;
    status;
    constructor(socket) {
        super();
        this.socket = socket;
        this.noForgot = false;
        this.history = new ChatHistory();
        this.status = chatStatus.pending;
        this.socket.once('message', (msg) => {
            let json;
            try {
                let json = JSON.parse(msg.toString());
            }
            catch (e) {
                this.socket.close(123, "Parse error");
            }
            let db = new Database();
            db.once('ready', () => {
                let create = () => {
                    this.hash = randomUUID();
                    this.socket.send(JSON.stringify({
                        event: "created",
                        data: { hash: this.hash }
                    }));
                };
                let restore = (name) => {
                    this.hash = json.hash;
                    this.socket.send(JSON.stringify({
                        event: "restored",
                        data: {
                            manager: name
                        }
                    }));
                };
                if (json.hash) { // try restore
                    db.get("SELECT COUNT(*), managerId as count FROM Chats WHERE hash=?", json.hash, (err, row) => {
                        if (err) {
                            create();
                        }
                        else {
                            if (row.count > 0) {
                                db.get("SELECT * FROM Managers WHERE id=?", row.managrId, (err, row) => {
                                    if (row.tgUserId) {
                                    }
                                });
                            }
                        }
                    });
                }
                else { // new client
                    create();
                }
            });
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
    accept(name) {
        this.status = chatStatus.active;
        this.socket.send(JSON.stringify({
            event: "accepted",
            data: {
                manager: name
            }
        }));
    }
    answer(text) {
        if (this.status = chatStatus.active) {
            this.socket.send(JSON.stringify({
                event: "answer",
                data: {
                    text: text
                }
            }));
        }
        else {
            console.error("DBUG: trying answer to not active chat");
        }
    }
}
class ChatServer {
    listener;
    noForgotTimeout;
    connections;
    dbBuffer;
    constructor() {
        this.dbBuffer = new ChatsBuffer();
        this.connections = new Set();
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
            console.log("Starting relay server");
        });
    }
    async dispoce() {
    }
}
