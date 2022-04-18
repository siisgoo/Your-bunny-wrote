import { EventEmitter } from 'events';
import sqlite3 from 'sqlite3';
const CreateQueries = new Map([
    [
        "History",
        'CREATE TABLE "History" ( "id" INTEGER NOT NULL, "chatId" INTEGER NOT NULL, "from" TEXT NOT NULL, "creator" TEXT NOT NULL, "time" INTEGER NOT NULL, "text" TEXT NOT NULL, "handled" INTEGER NOT NULL, PRIMARY KEY("id" AUTOINCREMENT));'
    ],
    [
        "Chats",
        'CREATE TABLE "Chats" ( "id" INTEGER NOT NULL, "hash" TEXT NOT NULL UNIQUE, "managerId" INTEGER UNIQUE, PRIMARY KEY("id" AUTOINCREMENT));'
    ],
    [
        "Managers",
        'CREATE TABLE "Managers" ( "id" INTEGER NOT NULL, "admin" INTEGER NOT NULL, "tgUserId" INTEGER NOT NULL UNIQUE, PRIMARY KEY("id" AUTOINCREMENT));'
    ]
]);
const ShowTablesQuery = "SELECT name FROM sqlite_schema WHERE type IN ('table') AND name NOT LIKE 'sqlite_%';";
export class Database extends sqlite3.Database {
    constructor() {
        super("rediirector.db", sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE);
        this.on('error', (e) => { throw e; });
        this.all(ShowTablesQuery, (err, rows) => {
            if (err) {
                throw err;
            }
            let exists = new Array();
            rows.forEach(row => exists.push(row.name));
            (async () => {
                for (let [name, query] of CreateQueries) {
                    if (!exists.includes(name)) {
                        await this.runSync(query).catch((e) => { throw e; });
                    }
                }
                this.emit('ready');
            })();
        });
    }
    deconstructor() {
        this.close();
    }
    async runSync(query) {
        return new Promise((resolve, reject) => {
            this.run(query, (err) => {
                if (err)
                    reject(err.message);
                else
                    resolve(true);
            });
        });
    }
}
export class DatabaseBuffer extends EventEmitter {
    list;
    db;
    syncTimer;
    constructor() {
        super();
        this.list = new Set();
        this.db = new Database();
    }
    dispose() {
        this.sync();
        this.once('synced', () => this.emit('disposed'));
    }
    setupDynamicSync(interval) {
        this.syncTimer = setInterval(this.sync, interval);
    }
    disableDynaicSync() {
        // @ts-ignore
        clearInterval(this.syncTimer);
    }
    sync() {
        this.emit('synced');
    }
}
