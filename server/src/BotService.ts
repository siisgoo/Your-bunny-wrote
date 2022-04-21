import * as tg from 'telegraf';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Database, DatabaseBuffer, DatabaseManagerEntry } from './database.js';
import { managerStatus } from './constants.js';
import { ChatServer } from './ChatService.js';

class ManagersStorage extends DatabaseBuffer<DatabaseManagerEntry> {
    constructor() {
        super("Managers", [ "id", "admin", "tgUserId", "linkedChat", "online" ], "tgUserId", false);
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
                .catch(err => { throw err; });
        })

        this.chatService.on("message", (hash: string, managerId: number | undefined, message: ChatMessage) => {
            if (managerId) {
                this.bot.telegram.sendMessage(managerId, "Customer \"" + message.creator + "\" sends:\n" + message.text);
            }
        });

        let acceptChatMarkup = (hash: string) => tg.Markup.inlineKeyboard([ tg.Markup.button.callback("Accept", "accept " + hash), tg.Markup.button.callback("Decline", "decline " + hash) ])

        this.chatService.on("newChat", (hash: string) => {
            this.managers.find("online", Number(true))
                .then((mngrs: DatabaseManagerEntry[]) => {
                    mngrs.forEach((mngr) => {
                        this.bot.telegram.sendMessage(mngr.tgUserId, "Incoming chat invetation", acceptChatMarkup(hash));
                    })
                })
                .catch((e) => console.log(e));
        });

        this.chatService.on("restoredChat", (hash: string) => {

        });

        this.chatService.on("endChat", (hash: string, managerId: number) => {
            if (managerId) {
                this.managers.update(managerId, { linkedChat: null });
                this.bot.telegram.sendMessage(managerId, "Client leave chat");
            }
        });

        // identification midleware
        this.bot.use(async (ctx, next) => {
            // @ts-ignore
            let mngr = await this.managers.get(ctx.from.id);
            if (mngr) {
                if (mngr.admin) ctx.admin = true;
                else ctx.admin = false;
                return next();
            } else if (ctx.updateType == 'callback_query') {
                return next();
            } else {
                ctx.replyWithMarkdown("Welcome to rediirector bot. To start using bot you need to be aproved by bot adimnistraton.\n" +
                                      "Full documentation represents [here](https://github.com/siisgoo/rediirector/blob/main/README.md)");
                ctx.reply("Click on button for send approve request",
                          tg.Markup.inlineKeyboard([ [ { text: "Send", callback_data: "approve_request" }, ] ]));
            }
        })

        this.bot.start(ctx => {
        })

        this.bot.action('approve_request', (ctx) => {
            let keyboard = tg.Markup.inlineKeyboard([ [
                {   text: "Approve",
                    callback_data: "approve_manager " + ctx!.from!.id },
                {   text: "Reject",
                    callback_data: "reject_manager " + ctx!.from!.id }
            ] ])
            // @ts-ignore
            ctx.telegram.sendMessage(config.bot.admin_id, "Autorization request from @" + ctx.from.username,
                                     keyboard);
        })

        this.bot.action('approve_manager', (ctx) => {

        });

        this.bot.action('reject_manager', ctx => {

        });

        this.bot.command('goonline', (ctx) => {
            this.managers.update(ctx.from.id, { online: Number(true) });
        });

        this.bot.command('gooffline', (ctx) => {
            this.managers.update(ctx.from.id, { online: Number(false) });
        });

        this.bot.command('chats', ctx => {
            if (ctx.admin) {

            } else {

            }
        });

        this.bot.command('accept', ctx => {
            let chatHash = ctx.message.text.slice('accept'.length+1);
            // @ts-ignore
            if (this.chatService.acceptChat(chatHash, ctx.from.first_name + " " + ctx.from.last_name)) {
                ctx.reply("Now you are in chat with customer");
            } else {
                ctx.reply("Selected chat expired");
            }
        })

        this.bot.action(/accept*/, (ctx, next)=> {
            let chatHash = ctx.match.input.slice('accept'.length+1);
            if (this.chatService.acceptChat(chatHash, ctx.from!.id, ctx.from!.first_name + " " + ctx.from!.last_name)) {
                this.managers.update(ctx.from!.id, { linkedChat: chatHash })
                ctx.reply("Now you are in chat with customer").then(() => next());
            } else {
                ctx.reply("Selected chat expired");
            }
        });

        this.bot.command('close', ctx => {
            // this.chatService.closeChat();
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
                let msg = ctx.reply("You are not connected to chat, this message will be deleted");
                setTimeout(async () => {
                    ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
                    ctx.telegram.deleteMessage(ctx.chat.id, (await msg).message_id);
                }, 5000);
            }
        });

    }

    deconstructor() {
        this.bot.stop();
    }

    async stop() {
        
    }
}
