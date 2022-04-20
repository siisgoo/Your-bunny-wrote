import * as fs from 'fs';
import cache from 'node-cache';
import { EventEmitter } from 'events';
import sqlite3 from 'sqlite3';

const CreateQueries = new Map<string, string>(
    [
        [
            "History",
            'CREATE TABLE "History" ( "id" INTEGER NOT NULL, "chatHash" TEXT NOT NULL, "from" TEXT NOT NULL, "creator" TEXT NOT NULL, "time" INTEGER NOT NULL, "text" TEXT NOT NULL, "handled" INTEGER NOT NULL, PRIMARY KEY("id" AUTOINCREMENT));'
        ],
        [
            "Chats",
            'CREATE TABLE "Chats" ( "hash" TEXT NOT NULL UNIQUE, "managerId" INTEGER UNIQUE, PRIMARY KEY("hash"));'
        ],
        [
            "Managers",
            'CREATE TABLE "Managers" ( "id" INTEGER NOT NULL, "admin" INTEGER NOT NULL, "tgUserId" INTEGER NOT NULL UNIQUE, "linkedChat" TEXT NULL, "online" INTEGER NOT NULL, PRIMARY KEY("id" AUTOINCREMENT));'
        ]
    ]
);

export interface DatabaseEntry {
    id?: number,
}

export interface DatabaseChatEntry extends DatabaseEntry {
    hash: string,
    managerId: number | null,
}

export interface DatabaseManagerEntry extends DatabaseEntry {
    admin: number, // boolean c-style
    tgUserId: number,
    linkedChat: string | null,
    online: number, // boolean c-style
}

const ShowTablesQuery = "SELECT name FROM sqlite_schema WHERE type IN ('table') AND name NOT LIKE 'sqlite_%';";

export class Database extends sqlite3.Database {
    constructor() {
        super("rediirector.db", sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE);

        this.on('error', (e: Error) => {throw e});

        let exists = new Array<string>();
        this.prepare(ShowTablesQuery)
            .each((err: Error, row: any) => {
                if (err) { throw err; }
                exists.push(row.name);
            }, (err: Error, count: number) => {
                if (err) {
                    throw "Cannot init Database: " + err;
                }

                (async () => {
                    for (let [name, query] of CreateQueries) {
                        if (!exists.includes(name)) {
                            await this.runSync(query).catch((e: Error) => { throw e });
                        }
                    }
                    this.emit('ready');
                })()
            })
    }


    deconstructor() {
        this.close();
    }

    async runSync(query: string) {
        return new Promise((resolve, reject) => {
            this.run(query, (err: Error) => {
                if (err)
                    reject(err.message)
                else
                    resolve(true)
            })
        })
    }

    async allSync(query: string, params: any[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.all(query, params, (err: Error | null, rows: any[]) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        })
    }
}

interface DatabaseProxyParams
{
    insertQuery: string,
    deleteQuery: string,
    selectQuery: string,
    updateQuery: string,
}

export class DatabaseBuffer<KeyType, EntryType> extends EventEmitter {
    protected cache: cache;
    protected db: Database;
    protected syncTimer?: NodeJS.Timeout;

    protected insertQuery: string;
    protected deleteQuery: string;
    protected selectQuery: string;
    protected updateQuery: string;

    constructor(params: DatabaseProxyParams, protected keyName: string, protected useId: boolean = false) {
        super();
        this.insertQuery = params.insertQuery;
        this.deleteQuery = params.deleteQuery;
        this.updateQuery = params.updateQuery;
        this.selectQuery = params.selectQuery;

        this.cache = new cache({ stdTTL: 100, checkperiod: 1000, maxKeys: 100 });
        // update on delete from cache
        // @ts-ignore
        this.cache.on('del', (key: KeyType, entry: EntryType) => {
            // @ts-ignore
            if (!this.useId) { delete entry.id }
            let toWrite = Object.values(entry);
            // @ts-ignore
            toWrite.push(key);
            console.log(toWrite);
            this.db.prepare(this.updateQuery).run(toWrite).finalize();
        });

        this.db = new Database();
    }

    async add(key: KeyType, entry: EntryType) {
        // @ts-ignore
        if (this.cache.getStats().keys >= this.cache.options.maxKeys) {
            // remove last entry
            this.cache.del(
                this.cache.keys()[this.cache.keys().length - 1]
            )
        }
        // @ts-ignore
        this.cache.set(key, entry);
        // @ts-ignore
        if (!this.useId) { delete entry.id }
        let toWrite = Object.values(entry);
        console.log(toWrite);
        return new Promise((resolve, reject) =>
                this.db.prepare(this.insertQuery)
                    .run(toWrite, (err: Error | null) => {
                        if (err)
                            reject(err);
                        else
                            resolve(true);
                    }).finalize()
        );
    }

    async remove(key: KeyType) {
        if (await this.get(key)) {
            // @ts-ignore
            this.cache.del(key);
            await new Promise((resolve, reject) =>
                    this.db.prepare(this.deleteQuery)
                        .run(key, (err: Error | null) => {
                            if (err)
                                reject(err);
                            else
                                resolve(true);
                        }).finalize()
            );
        }
    }

    async get(key: KeyType): Promise<EntryType | undefined> {
        // @ts-ignore
        if (this.cache.has(key)) {
            // @ts-ignore
            return this.cache.get(key);
        }

        // try localize in fs
        return new Promise((resolve, reject) => {
            this.db.all(this.selectQuery, [ key ], (err: Error, rows: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    if (rows.length > 0) {
                        this.cache.set(rows[0][this.keyName], rows[0])
                        resolve(rows[0]);
                    } else {
                        reject(undefined);
                    }
                }
            })
        });
    }

    async update(key: KeyType, entry: EntryType) {
        // @ts-ignore
        if (this.cache.get(key)) {
            // @ts-ignore
            this.cache.del(key);
            // @ts-ignore
            this.cache.set(key, entry);
        }
        try {
            // @ts-ignore
            if (!this.useId) { delete entry.id }
            let toWrite = Object.values(entry);
            // @ts-ignore
            toWrite.push(key);
            console.log(toWrite);
            this.db.prepare(this.updateQuery).run(toWrite).finalize();
        } catch(e) {

        }
    }
}
