import * as tg from 'telegraf'
import { EventEmitter } from 'events'
import { Database, Manager, Chat } from './database.js'
import { ChatServer } from './ChatService.js'
import { Config } from './Config.js'
import { ChatMessage } from './Schemas/ChatMessage.js'

interface Context extends tg.Context {
    manager: Manager
}

export class BotService extends EventEmitter {
    private readonly bot: tg.Telegraf<Context>;
    private readonly chatService: ChatServer;

    constructor() {
        super();
        this.chatService = new ChatServer();

        this.bot = new tg.Telegraf(Config().bot.token);

        this.chatService.onChatManagerRequest = async (chat: Chat) => {
            if (chat.managerId) {
                await this.bot.telegram.sendMessage(chat.managerId, "Customer " + chat.initiator + " return to chat");
            } else {
                let online = await Database.managers.findMany({ online: true });
                for await (let m of online) {
                    this.bot.telegram.sendMessage(m.userId, "Incoming chat invetation from " + chat.initiator, this.createEnterChatMarkup(chat.hash));
                }
            }
        }

        this.chatService.onChatClosed = async (chat: Chat, waitReq: boolean) => {
            if (waitReq) {
                this.bot.telegram.sendMessage(Number(chat.managerId), "Client reloading page or something, you still can leave or close this chat");
            } else {
                chat.managerId = null;
                await chat.sync();
                this.bot.telegram.sendMessage(Number(chat.managerId), "Client closed chat");
            }
        }

        this.chatService.onChatMessage = async (chat: Chat, message: ChatMessage) => {
            if (chat.managerId) { // mean connected?
                this.bot.telegram.sendMessage(chat.managerId, message.from.name + ":\n" + message.text);
                if (message.attachments.length) {
                    message.attachments.forEach(async (a) => {
                        switch (a.file_mime) {
                            // case "jpeg":
                                // this.bot.telegram.sendPhoto(Number(chat.managerId), a.);
                                // break;
                            // case "df":
                            //     break;
                            default:
                                console.error("DEBUG: unknown message attachment mime passed: ", a.file_mime);
                        }
                    })
                }
            }
        }

        // identification midleware
        this.bot.use(async (ctx, next) => {
            let mngr = await Manager.findOne({ userId: ctx.from!.id })
            if (mngr) {
                ctx.manager = mngr;
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
                    ctx.reply("Incoming invetation from " + chat.initiator, this.createEnterChatMarkup(chat.hash));
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
            if (ctx.manager.isAdmin) {

            } else {

            }
        });

        this.bot.command('enter', async ctx => {
            let chatHash = ctx.message.text.slice('enter'.length+1);
            // avoiding ts warning
            if (this.chatService.enterChat(chatHash, ctx.manager)) {
                ctx.manager.linkToChat(chatHash)
                ctx.reply("Now you are in chat with customer");
            } else {
                ctx.reply("Selected chat expired");
            }
        })

        this.bot.action(/enter*/, async (ctx, next)=> {
            let chatHash = ctx.match.input.slice('enter'.length+1);
            // avoiding ts warning
            if (this.chatService.enterChat(chatHash, ctx.manager)) {
                ctx.manager.linkToChat(chatHash);
                ctx.reply("Now you are in chat with customer").then(() => next());
            } else {
                ctx.reply("Selected chat expired").then(() => next());
            }
        });

        this.bot.command('close', async ctx => {
            if (ctx.manager.linkedChat) {
                this.chatService.closeChat(ctx.manager.linkedChat);
                ctx.manager.unlinkChat();
                ctx.reply("Chat successfuly closed");
            } else {
                ctx.reply("Close chat command will be avalible only after entering any chat");
            }
        });

        this.bot.command('leave', async ctx => {
            if (ctx.manager.linkedChat) {
                this.chatService.leaveChat(ctx.manager.linkedChat);
                ctx.manager.unlinkChat();
                ctx.reply("Chat successfuly leaved, " + (await Chat.findOne({ managerId: ctx.manager.userId }))!.initiator + " will wait for another manager");
            } else {
                ctx.reply("Leave chat command will be avalible only after entering any chat");
            }
        });

        this.bot.on('text', async ctx => {
            if (ctx.manager.linkedChat) {
                this.chatService.answerTo(ctx.manager.linkedChat, {
                    id: -1,
                    stamp: ctx.message.date,
                    from: {
                        name: ctx.manager.name,
                        type: 'manager'
                    },
                    text: ctx.message.text,
                    attachments: []
                });
            } else {
                let msg = await ctx.reply("You are not connected to chat, those messages will be deleted");
                setTimeout(async () => {
                    ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
                    ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
                }, 5000);
            }
        });
    }

    deconstructor() {
    }

    async start() {
        Database.managers.findOne({ userId: Config().bot.admin_id })
            .then(e => {
                if (!e) {
                    Database.managers.insertOne({
                        isAdmin: true,
                        name: "Admin",
                        userId: Config().bot.admin_id,
                        linkedChat: null,
                        online: false
                    })
                }
            })
            .then(() => {
                this.bot.launch()
                    .then(async () => {
                        for (let mngr of await Manager.findMany({  })) {
                            this.bot.telegram.sendMessage(mngr.userId, "Service now online");
                        }
                        console.log("Telegram-bot service started");
                    })
                    .catch(err => { throw err; });
            })
    }

    async stop() {
        let mngrs = Database.managers.documents;
        for (let m of mngrs) {
            await this.bot.telegram.sendMessage(m.userId, "Service going offline, your status will be reseted to offline");
        }
        await this.chatService.stop();
        this.bot.stop();
        await Database.managers.updateMany({ online: true }, { online: false, linkedChat: null });
        await Database.managers.save();
    }

    private createEnterChatMarkup(hash: string) {
        return tg.Markup.inlineKeyboard([ tg.Markup.button.callback("Accept", "chat_enter" + hash),
                                          tg.Markup.button.callback("Decline", "chat_decline " + hash) ])
    }

    // private createMainKeyboard() {
    //     return tg.Markup.keyboard([
    //         tg.Markup.button.callback("Status", "menu_status")
    //     ]);
    // }
}

