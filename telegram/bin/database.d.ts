/// <reference types="node" />
import { EventEmitter } from 'events';
import sqlite3 from 'sqlite3';
export declare class Database extends sqlite3.Database {
    constructor();
    deconstructor(): void;
    runSync(query: string): Promise<unknown>;
}
export interface DatabaseEntry {
    id: number;
}
export declare class DatabaseBuffer<EntryType> extends EventEmitter {
    protected list: Set<EntryType>;
    protected db: Database;
    protected syncTimer?: NodeJS.Timeout;
    protected constructor();
    protected dispose(): void;
    protected setupDynamicSync(interval: number): void;
    protected disableDynaicSync(): void;
    protected sync(): void;
}
