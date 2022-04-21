import * as tg from 'telegraf';
import { EventEmitter } from 'events';
import { Database, Manager } from './database.js';
import { ChatServer } from './ChatService.js';
import { Config } from './Config.js';

interface Context extends tg.Context {
    admin: boolean,
}

export class BotService extends EventEmitter {
    private bot: tg.Telegraf<Context>;
    private chatService: ChatServer;

    constructor() {
        super();
        this.chatService = new ChatServer();

        // if (!config.bot.token.match(/^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$/)) {
        //     console.error("Invalid bot api token: ", config.bot.token);
        //     process.exit(-1);
        // }

        this.bot = new tg.Telegraf(Config().bot.token);

        this.chatService.on("message", (managerId: number, message: ChatMessage) => {
            if (managerId) {
                this.bot.telegram.sendMessage(managerId, "Customer \"" + message.from.name + "\" sends:\n" + message.text);
            }
        });

        let acceptChatMarkup = (hash: string) => tg.Markup.inlineKeyboard([ tg.Markup.button.callback("Accept", "accept " + hash), tg.Markup.button.callback("Decline", "decline " + hash) ])

        this.chatService.on("newChat", async (hash: string, initiator: string) => {
            let online = await Database.managers.findMany({ online: true });
            for await (let m of online) {
                this.bot.telegram.sendMessage(m.userId, "Incoming chat invetation from " + initiator, acceptChatMarkup(hash));
            }
        });

        this.chatService.on("restoredChat", (hash: string) => {
            console.log("Unhandled", hash);
        });

        this.chatService.on("endChat", (managerId: number) => {
            if (managerId) {
                Database.managers.updateOne({ userId: managerId }, { linkedChat: null });
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
            ctx.reply("Yo");
            ctx.replyWithSticker("CAACAgIAAxkBAAEEh8ZiYap4c-H3_TzWfSLp5J7fQLZLxQACshIAA3VJSlVDVklAPgmCJAQ");
        })

        this.bot.action('approve_request', (ctx) => {
            let keyboard = tg.Markup.inlineKeyboard([ [
                {   text: "Approve",
                    callback_data: "approve_manager " + ctx!.from!.id },
                {   text: "Reject",
                    callback_data: "reject_manager " + ctx!.from!.id }
            ] ])
            ctx.telegram.sendMessage(Config().bot.admin_id, "Autorization request from @" + ctx.from!.username,
                                     keyboard);
        })

        // this.bot.action('approve_manager', (ctx) => {

        // });

        // this.bot.action('reject_manager', (ctx) => {

        // });

        // TODO
        // use CAACAgIAAxkBAAEEh9JiYate-8ItpkQBSCowdGmwTHzR8wAC0hEAAjnxkUtIXF3Fd0t44iQE
        // FOR ONLINE IDLE TIMEOUT

        this.bot.command('goonline', async (ctx) => {
            Database.managers.updateOne({ userId: ctx.from.id }, { online: true });
            ctx.reply("You are online now");
            ctx.replyWithSticker("CAACAgIAAxkBAAEEh9BiYatNE-M0LO7eJ6A8rERHIennowAC9A8AAuauOUpmEnHaU53szyQE")

            let pending = await Database.chats.findMany({ managerId: null });
            if (pending.length > 0) {
                ctx.reply("During your absence " + pending.length + " peoplec need your help");
                for (let chat of pending) {
                    ctx.reply("Incoming invetation from " + chat.initiator, acceptChatMarkup(chat.hash));
                }
            }
        });

        this.bot.command('gooffline', (ctx) => {
            Database.managers.updateOne({ userId: ctx.from.id }, { online: false });
            ctx.reply("You are offline now");
            ctx.replyWithSticker("CAACAgIAAxkBAAEEh9ZiYavBfd0mfaBWTzqMeBSYbwkB7wACjxMAAosj2UpwO-yY639C-iQE");

            // TODO delete queries from ctx chat
        });

        this.bot.command('chats', ctx => {
            if (ctx.admin) {

            } else {

            }
        });

        this.bot.command('accept', ctx => {
            let chatHash = ctx.message.text.slice('accept'.length+1);
            if (this.chatService.acceptChat(chatHash, ctx.from!.id, ctx.from!.first_name + " " + ctx.from!.last_name)) {
                Database.managers.updateOne({ userId: ctx.from!.id }, { linkedChat: chatHash })
                ctx.reply("Now you are in chat with customer");
            } else {
                ctx.reply("Selected chat expired");
            }
        })

        this.bot.action(/accept*/, (ctx, next)=> {
            let chatHash = ctx.match.input.slice('accept'.length+1);
            if (this.chatService.acceptChat(chatHash, ctx.from!.id, ctx.from!.first_name + " " + ctx.from!.last_name)) {
                Database.managers.updateOne({ userId: ctx.from!.id }, { linkedChat: chatHash })
                ctx.reply("Now you are in chat with customer").then(() => next());
            } else {
                ctx.reply("Selected chat expired").then(() => next());
            }
        });

        this.bot.command('close', async ctx => {
            let m = await Manager.findOne({ userId: ctx.from!.id });
            if (m!.linkedChat) {
                this.chatService.closeChat(m!.linkedChat);
                m!.unlinkChat();
                ctx.reply("Chat successfuly closed");
            } else {
                ctx.reply("Close chat command will be avalible only after accepting any chat");
            }
        });

        this.bot.command('leave', async ctx => {
            let m = await Manager.findOne({ userId: ctx.from!.id });
            if (m!.linkedChat) {
                this.chatService.leaveChat(m!.linkedChat);
                m!.unlinkChat();
                ctx.reply("Chat successfuly leaved, " + (await Database.chats.findOne({ managerId: ctx.from.id }))!.initiator + " will wait for another manager");
            } else {
                ctx.reply("Leave chat command will be avalible only after accepting any chat");
            }
        });

        this.bot.on('text', async ctx => {
            // @ts-ignore
            let chatHash = (await Database.managers.findOne({ userId: ctx.from.id })).linkedChat;
            if (chatHash) {
                this.chatService.answerTo(chatHash, {
                    id: -1,
                    stamp: ctx.message.date,
                    from: {
                        name: ctx.from.first_name + " " + ctx.from.last_name,
                        type: 'manager'
                    },
                    text: ctx.message.text,
                });
            } else {
                let msg = ctx.reply("You are not connected to chat, those messages will be deleted");
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

    async start() {
        Database.managers.findOne({ userId: Config().bot.admin_id })
            .then(e => {
                if (!e) {
                    Database.managers.insertOne({
                        isAdmin: true,
                        userId: Config().bot.admin_id,
                        linkedChat: null,
                        online: false
                    })
                }
            })
            .then(() => {
                this.bot.launch()
                    .then(() => {
                        console.log("Telegram-bot service started");
                    })
                    .catch(err => { throw err; });
            })
    }

    async stop() {
        let mngrs = await Database.managers.findMany();
        for await (let m of mngrs) {
            await this.bot.telegram.sendMessage(m.userId, "Service going offline, your status will be reseted to offline");
        }
        this.bot.stop();
        await Database.managers.updateMany({ online: true }, { online: false, linkedChat: null });
        await Database.managers.save();
    }

    setupChatToBotChannel() {

    }
}

