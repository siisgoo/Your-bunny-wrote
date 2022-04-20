import * as tg from 'telegraf';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Database, DatabaseBuffer, DatabaseManagerEntry } from './database.js';
import { managerStatus } from './constants.js';
import { ChatServer } from './ChatService.js';

class ManagersStorage extends DatabaseBuffer<number, DatabaseManagerEntry> {
    constructor() {
        super({
            insertQuery: "INSERT INTO Managers (admin, tgUserId, linkedChat, online) VALUES(?,?,?,?)",
            deleteQuery: "DELETE FROM Managers WHERE tgUserId=?",
            updateQuery: "UPDATE Managers SET admin=?, tgUserId=?, linkedChat=?, online=? WHERE tgUserId=?",
            selectQuery: "SELECT * FROM Managers WHERE tgUserId=?"
        }, "tgUserId", false);
        const config = JSON.parse(fs.readFileSync("config.json", 'utf8'));

        this.db.on('ready', () => {
            this.db.all("SELECT * FROM Managers", async (err: Error, row: any[]) => {
                if (err) throw "Cannot init ManagersStorage: " + err;
                this.get(config.bot.admin_id).then(entry => {
                    if (!entry) {
                        let l_entry: DatabaseManagerEntry = {
                            admin: 1,
                            tgUserId: config.bot.admin_id,
                            linkedChat: null,
                            online: 0,
                        }
                        this.add(l_entry.tgUserId, l_entry);
                    }
                    this.emit('ready');
                })
            })
        })
    }

    deconstructor() {
    }
}

interface Context extends tg.Context {
    admin: boolean,
    autorized: boolean,
}

export class BotService extends EventEmitter {
    private bot: tg.Telegraf<Context>;
    private managers: ManagersStorage;
    private chatService: ChatServer;

    constructor() {
        super();
        this.managers = new ManagersStorage();
        this.chatService = new ChatServer();
        const config = JSON.parse(fs.readFileSync("config.json", 'utf8'));

        if (!config.bot.token.match(/^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$/)) {
            console.error("Invalid bot api token: ", config.bot.token);
            process.exit(-1);
        }

        this.bot = new tg.Telegraf(config.bot.token);

        this.managers.on('ready', () => {
            this.bot.launch()
                .then(() => {
                    console.log("Telegram-bot service started");
                })
                .catch(err => {
                    console.error("Cannot start bot: ", err);
                });
        })

        let sendRegistrationMessage = (ctx: Context) =>
                ctx.reply("Click on button for send approve request",
                          tg.Markup.inlineKeyboard([ [ { text: "Send", callback_data: "approve_request" }, ] ]));

        this.chatService.on("message", (hash: string, managerId: number | null, message: ChatMessage) => {
            if (managerId) {
            }
        });

        this.chatService.on("newChat", (hash: string) => {

        });

        // identification midleware
        this.bot.use(async (ctx, next) => {
            // @ts-ignore
            let mngr = await this.managers.get(ctx.from.id);
            if (mngr) {
                ctx.autorized = true;
                if (mngr.admin) ctx.admin = true;
                else ctx.admin = false;
                return next();
            } else if (ctx.updateType == 'callback_query') {
                return next();
            } else {
                sendRegistrationMessage(ctx);
            }
        })

        this.bot.start(ctx => {
            if (ctx.autorized) {
                ctx.reply("You account alrady approved");
            } else {
                ctx.replyWithMarkdown("Welcome to rediirector bot. To start using bot you need to be aproved by bot adimnistraton.\n" +
                                      "Full documentation represents [here](https://github.com/siisgoo/rediirector/blob/main/README.md)");
                sendRegistrationMessage(ctx);
            }
        })

        this.bot.action('approve_request', (ctx) => {
            if (ctx.autorized) {
                ctx.reply("Your account aready approved");
            } else {
                let keyboard = tg.Markup.inlineKeyboard([ [
                    {   text: "Approve",
                        // @ts-ignore
                        callback_data: "approve_manager " + ctx.from.id },
                    {   text: "Reject",
                        // @ts-ignore
                        callback_data: "reject_manager " + ctx.from.id }
                ] ])
                // @ts-ignore
                ctx.telegram.sendMessage(config.bot.admin_id, "Autorization request from @" + ctx.from.username,
                                         keyboard);
            }
        })

        this.bot.action('approve_manager', (ctx) => {

        });

        this.bot.action('reject_manager', ctx => {

        });

        this.bot.command('goonline', (ctx) => {

        });

        this.bot.command('gooffline', (ctx) => {

        });

        this.bot.command('chats', ctx => {

        });

        this.bot.command('accept', ctx => {
            let chatHash = ctx.message.text.slice('accept'.length+2);
            // @ts-ignore
            if (this.chatService.acceptChat(chatHash, ctx.from.first_name + " " + ctx.from.last_name)) {

            }
        })

        this.bot.action('accept', (ctx, next)=> {
            let chatHash = ctx.slice('accept'.length+2)
        });

        this.bot.command('close', ctx => {

        });

        this.bot.command('leave', ctx => {

        });

        this.bot.on('text', async ctx => {
            // @ts-ignore
            let chatHash = (await this.managers.get(ctx.from.id)).linkedChat;
            if (chatHash) {
                this.chatService.answerTo(chatHash,
                                          {
                                              id: -1,
                                              text: ctx.message.text,
                                              from: 'manager',
                                              creator: ctx.from.first_name + " " + ctx.from.last_name,
                                              time: ctx.message.date
                                          });
            } else {
                ctx.reply("You are not connected to chat, wait for requsts");
            }
        });

    }

    deconstructor() {
        this.bot.stop();
    }
}

