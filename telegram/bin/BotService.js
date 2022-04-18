import * as tg from 'telegraf';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Database, DatabaseBuffer } from './database.js';
import { managerStatus } from './constants.js';
class Manager extends EventEmitter {
    user_id;
    admin;
    linkedChat;
    status;
    constructor(user_id, admin = false) {
        super();
        this.user_id = user_id;
        this.admin = admin;
        this.status = managerStatus.offline;
    }
    get ID() {
        return this.user_id;
    }
    get isAdmin() {
        return this.admin;
    }
    get LinkedChat() {
        return this.linkedChat;
    }
    revoce() {
        this.emit('revoke', this.user_id);
    }
    enterChat(siteChatId) {
    }
    closeChat() {
    }
    leaveChat() {
    }
}
class ManagersList extends DatabaseBuffer {
    constructor() {
        super();
        const config = JSON.parse(fs.readFileSync("config.json", 'utf8'));
        const db = new Database();
        db.once('ready', () => {
            db.all("SELECT * FROM Managers", (err, rows) => {
                if (err)
                    throw "Cannot init ManagersList: " + err;
                else {
                    rows.forEach(mngr => {
                        this.register(mngr.tgUserId, mngr.admin);
                    });
                }
                if (!this.get({ user_id: config.bot.admin_id })) {
                    this.register(config.bot.admin_id, true);
                }
                this.emit('ready');
            });
        });
    }
    deconstructor() {
    }
    register(user_id, admin = false) {
        let mngr = new Manager(user_id, admin);
        this.list.add(mngr);
        mngr.once('revoke', () => this.remove(mngr));
    }
    get(arg) {
        for (let v of this.list) {
            if (v.ID === arg.user_id) {
                return v;
            }
        }
        return undefined;
    }
    each(callbackfn, arg) {
        this.list.forEach(callbackfn, arg);
    }
    remove(mngr) {
        this.list.delete(mngr);
    }
    dispose() {
        this.sync();
        this.once('synced', () => this.emit('disposed'));
    }
    setupDynamicSync(interval) {
        this.syncTimer = setInterval(() => this.sync, interval);
    }
    disableDynaicSync() {
        super.disableDynaicSync();
    }
    // save to database
    sync() {
        const db = new Database();
        db.once('ready', () => {
            db.all("SELECT * FROM Managers", (err, rows) => {
                if (err) {
                    console.error(err);
                    return;
                }
                let exists = new Array();
                rows.forEach(v => {
                    exists.push({ id: v.tgUserId, isAdmin: v.admin });
                });
                for (let mngr of this.list) {
                    if (!exists.includes({ id: mngr.ID })) { // add new
                        db.run("INSERT INTO Managers (tgUserId, admin) VALUES(?, ?)", mngr.ID, Number(mngr.isAdmin), (err) => { if (err) {
                            console.error(err);
                        } });
                    }
                }
                super.sync();
            });
        });
    }
}
export class BotService extends EventEmitter {
    bot;
    constructor() {
        super();
        let config = JSON.parse(fs.readFileSync("config.json", 'utf8'));
        if (!config.bot.token.match(/^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$/)) {
            console.error("Invalid bot api token: ", config.bot.token);
            process.exit(-1);
        }
        this.bot = new tg.Telegraf(config.bot.token);
        let managers = new ManagersList();
        managers.on('ready', () => {
            managers.setupDynamicSync(1000);
            managers.on('synced', () => console.log("syncing"));
            this.bot.launch()
                .then(() => {
                console.log("Telegram-bot service started");
            })
                .catch(err => {
                console.error("Cannot start bot: ", err);
            });
        });
        // authorization midleware
        this.bot.use((ctx, next) => {
            // @ts-ignore
            console.log(ctx.chat.id);
            // @ts-ignore
            let mngr = managers.get({ user_id: ctx.from.id });
            if (mngr) {
                ctx.autorized = true;
                if (mngr.isAdmin)
                    ctx.admin = true;
                else
                    ctx.admin = false;
            }
            return next();
        });
        this.bot.start(ctx => {
            if (ctx.autorized) {
                ctx.reply("You account alrady approved");
            }
            else {
                ctx.reply("Welcome to Tech-it rediirector. To start using bot you need to be aproved by bot adimnistraton, for send request use /register command");
            }
        });
        this.bot.command('register', (ctx) => {
            // if (ctx.autorized) {
            //     ctx.reply("Your account aready approved");
            // } else {
            let keyboard = tg.Markup.inlineKeyboard([
                [
                    {
                        text: "Approve",
                        callback_data: "approve_manager"
                    },
                    {
                        text: "Reject",
                        callback_data: "reject_manager"
                    }
                ]
            ]);
            // @ts-ignore
            ctx.telegram.sendMessage(config.bot.admin_id, "Autorization request from @" + ctx.from.username, keyboard);
            // }
        });
        this.bot.on('text', ctx => {
            if (!ctx.autorized) {
                ctx.reply("You are not autorized");
            }
            else {
                ctx.reply("Bip-bop");
            }
        });
    }
    deconstructor() {
        this.bot.stop();
    }
}
