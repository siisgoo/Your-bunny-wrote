import * as fs from 'fs';
import cache from 'node-cache';
import { EventEmitter } from 'events';
import sqlite3 from 'sqlite3';
// import keys from 'ts-transformer-keys';

const CreateQueries = new Map<string, string>(
    [
        [
            "History", // TODO id
            'CREATE TABLE "History" ( "id" INTEGER NULL, "chatHash" TEXT NOT NULL, "from" TEXT NOT NULL, "creator" TEXT NOT NULL, "time" INTEGER NOT NULL, "text" TEXT NOT NULL, "handled" INTEGER NOT NULL);'
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

export interface DatabaseHistoryEntry extends ChatMessage {
    chatHash: string,
    handled: number,
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

// TODO add global mutex
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

// TODO sync with db only on destroy or unload from cache
export class DatabaseBuffer<EntryType extends object> extends EventEmitter {
    protected cache: cache;
    protected db: Database;

    // protected fields: (keyof EntryType)[];

    protected insertQuery: string;
    protected deleteQuery: string;
    protected selectQuery: string;
    protected updateQuery: string;

    // TODO try to extract fields from EntryType
    constructor(protected table: string, protected fields: Array<keyof EntryType>, protected keyName: keyof EntryType, protected useId: boolean = false) {
        super();

        // this.fields = keys<EntryType>();

        let l_fileds = (this.useId ? this.fields : this.fields.filter(v => v != "id")).map(v => '"' + v + '"');
        this.insertQuery = "INSERT INTO " + this.table + "(" + l_fileds.toString() + ") " +
                           "VALUES(" + l_fileds.map(v => "?").toString() + ")";
        this.deleteQuery = "DELETE FROM " + this.table + " WHERE \"" + this.keyName + "\"=?";
        this.selectQuery = "SELECT * FROM " + this.table + " WHERE \"" + this.keyName + "\"=?";
        this.updateQuery = "UPDATE " + this.table + " SET " +
            l_fileds.map(v => v + "=?").toString() + " " +
            "WHERE " + this.keyName + "=?";

        this.cache = new cache({ stdTTL: 100, checkperiod: 1000, maxKeys: 100 });
        // update on delete from cache
        this.cache.on('del', (key: any, entry: EntryType) => {
            // @ts-ignore
            if (!this.useId) { delete entry.id }
            let toWrite = Object.values(entry);
            // @ts-ignore
            toWrite.push(key);
            this.db.prepare(this.updateQuery).run(toWrite).finalize();
        });

        this.db = new Database();
    }

    async add(key: any, entry: EntryType) {
        console.log("Adding", this.table, key, entry);
        if (this.cache.getStats().keys >= (this.cache.options.maxKeys || Number.MAX_SAFE_INTEGER)) {
            // remove last entry
            this.cache.del(
                this.cache.keys()[this.cache.keys().length - 1]
            )
        }
        this.cache.set(key, entry);
        // @ts-ignore
        if (!this.useId) { delete entry.id }
        let toWrite = Object.values(entry);
        console.log(this.insertQuery, toWrite);
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

    async remove(key: any) {
        console.log("Removing", this.table, key);
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

    async get(key: any): Promise<EntryType | undefined> {
        console.log("Getting", this.table, key);
        // @ts-ignore
        if (this.cache.has(key)) {
            // @ts-ignore
            return this.cache.get(key);
        }

        // try localize in fs
        return new Promise((resolve, reject) => {
            this.db.all(this.selectQuery, [ key ], (err: Error | null, rows: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    if (rows.length > 0) {
                        this.cache.set(rows[0][this.keyName], rows[0])
                        resolve(rows[0]);
                    } else {
                        resolve(undefined);
                    }
                }
            })
        });
    }

    async update(key: any, entry: object) {
        console.log("Updating", this.updateQuery, entry);
        let e_entry = this.cache.get(key);
        if (e_entry) {
            this.cache.del(key);
            this.cache.set(key, entry);
            try {
                let l_entry: EntryType = {
                    // @ts-ignore
                    ...e_entry,
                    ...entry
                }
                // @ts-ignore
                if (!this.useId) { delete l_entry.id }
                let toWrite = Object.values(l_entry);
                toWrite.push(key);
                this.db.prepare(this.updateQuery).run(toWrite).finalize();
            } catch(e) {

            }
        }
    }

    async find(field: string, value: number | string): Promise<EntryType[]> {
        console.log("Finding", this.table);
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM " + this.table + " WHERE \"" + field + "\"=?", value, (err: Error, rows: any[]) => {
                if (err) { console.log("JOP", err); reject(err) }
                else resolve(rows)
            })
        });
    }
}
