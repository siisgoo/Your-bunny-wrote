import * as tg from 'telegraf'
import { EventEmitter } from 'events'
import { Database, Manager, Chat } from './database.js'
import { ChatServer } from './ChatService.js'
import { Config } from './Config.js'

interface Context extends tg.Context {
    manager: Manager
}

export class BotService extends EventEmitter {
    private readonly bot: tg.Telegraf<Context>;
    private readonly chatService: ChatServer;

    private running: boolean = false;

    public onStop: () => void = () => {}

    private readonly stickers = {
        welcoming: "CAACAgIAAxkBAAEEh85iYatAqlMz81qfn7Dk303ummYrjwACGBEAAvE40EoZjSpXJ-H1-CQE",
        happy:     "CAACAgIAAxkBAAEEh9BiYatNE-M0LO7eJ6A8rERHIennowAC9A8AAuauOUpmEnHaU53szyQE",
        sad:       "CAACAgIAAxkBAAEEh9ZiYavBfd0mfaBWTzqMeBSYbwkB7wACjxMAAosj2UpwO-yY639C-iQE",
        evil:      "CAACAgIAAxkBAAEEh9JiYate-8ItpkQBSCowdGmwTHzR8wAC0hEAAjnxkUtIXF3Fd0t44iQE",
        verySad:   "CAACAgIAAxkBAAEEh9RiYaueiAN4zPax481xTRns1EYlRQAC0hAAAtOfOEp18SByrhUeJiQE",
    }

    constructor() {
        super();
        this.chatService = new ChatServer();

        this.bot = new tg.Telegraf(Config().bot.token);

        // send invites to all online and not already linked to chat manager
        this.chatService.on('managerRequest', async (chat) => {
            if (chat.managerId) {
                await this.bot.telegram.sendMessage(chat.managerId, "Customer " + chat.initiator + " return to chat");
            } else {
                let online = await Database.managers.findMany({ online: true, linkedChat: null });
                for await (let m of online) {
                    this.bot.telegram.sendMessage(m.userId, "Incoming chat invetation from " + chat.initiator, this.createEnterChatMarkup(chat.hash));
                }
            }
        })

        this.chatService.on('chatClosed', async (args) => {
            let { chat, waitReq } = args;
            if (chat.managerId) {
                if (waitReq) {
                    this.bot.telegram.sendMessage(chat.managerId, "Client reloading page or something, you still can leave or close this chat");
                } else {
                    this.bot.telegram.sendMessage(chat.managerId, "Client closed chat");
                    await chat.unlinkManager();
                    await (await Manager.findOne({ userId: chat.managerId }))!.unlinkChat();
                }
            }
        })

        this.chatService.on('chatMessage', (args) => {
            let { chat, message } = args;
            if (chat.managerId) {
                // this.bot.telegram.sendMessage(chat.managerId, message.from.name + ":\n" + message.text);
                this.bot.telegram.sendMessage(chat.managerId, chat.initiator + ":\n" + message.text);
                // if (message.attachments.length) {
                //     message.attachments.forEach(async (a) => {
                //         switch (a.file_mime) {
                //             // case "jpeg":
                //                 // this.bot.telegram.sendPhoto(Number(chat.managerId), a.);
                //                 // break;
                //             // case "df":
                //             //     break;
                //             default:
                //                 console.error("DEBUG: unknown message attachment mime passed: ", a.file_mime);
                //         }
                //     })
                // }
            }
        })

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
                          tg.Markup.inlineKeyboard([ [ { text: "Send", callback_data: "approve_request " + ctx.from!.id  }, ] ]));
            }
        })

        this.bot.start(async ctx => {
            await ctx.reply("Yo");
            ctx.replyWithSticker(this.stickers.welcoming);
        })

        this.bot.action(/approve_request*/, (ctx) => {
            let id = ctx.match.input.slice('chat_enter'.length);
            let keyboard = tg.Markup.inlineKeyboard([ [
                {   text: "Approve",
                    callback_data: "approve_manager " + id },
                {   text: "Reject",
                    callback_data: "reject_manager " + id }
            ] ])
            ctx.telegram.sendMessage(Config().bot.admin_id, "Autorization request from @" + ctx.from!.username,
                                     keyboard);
        })

        this.bot.action(/approve_manager*/, async (ctx) => {
            let userId = Number(ctx.match.input.slice('approve_manager'.length));
            let member = await this.bot.telegram.getChatMember(userId, userId);
            await (new Manager({
                userId: userId,
                name: member.user.first_name + " " + member.user.last_name,
                avatar: (await Database.files.getDefaultAvatar()).file_id
            })).sync();

            this.bot.telegram.sendMessage(userId, "Your request have been accepted. Now you are can use this bot ... and youa are the member of ...");
        });

        this.bot.action(/reject_manager*/, async (ctx) => {
            let userId = Number(ctx.match.input.slice('reject_manager'.length));
            await this.bot.telegram.sendMessage(userId, "Your request have been rejected");
            this.bot.telegram.sendSticker(userId, this.stickers.evil);
        });

        this.bot.command('status', ctx => {
            ctx.reply("Your status: " + (ctx.manager.online ? "online" : "offline"))
        })

        this.bot.command('setname', async (ctx) => {
            let name = String(ctx.message.text.slice('setname'.length+2)).trim();
            if (name !== "") {
                await ctx.manager.setName(name);
                ctx.reply("Now your will called " + name);
            } else {
                ctx.reply('No string passed, try: "/setname The Emperor"');
            }
        })

        this.bot.command('updateavatar', async (ctx) => {
            let photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
            let file = await ctx.telegram.getFile(photos.photos[0][0].file_id);
            let url = await ctx.telegram.getFileLink(file.file_id);
            let l_file = await Database.files.saveFile(url.href, "avatars");
            if (l_file) {
                await ctx.manager.setAvatar(l_file.file_id);
            } else {
                ctx.reply("Loading error. Try another time");
            }
        })

        this.bot.command('goonline', async (ctx) => {
            await ctx.manager.setOnline(true);
            ctx.reply("You are online now");
            ctx.replyWithSticker(this.stickers.happy)

            let pending = await Database.chats.findMany((ch) => { return !ch.managerId && ch.online && ch.waitingManager });
            if (pending.length > 0) {
                await ctx.reply("During your absence " + pending.length + " peoplec need your help");
                for (let chat of pending) {
                    ctx.reply("Incoming invetation from " + chat.initiator, this.createEnterChatMarkup(chat.hash));
                }
            }
        });

        this.bot.command('gooffline', async (ctx) => {
            await ctx.manager.setOnline(false);
            ctx.reply("You are offline now");
            ctx.replyWithSticker(this.stickers.sad);

            // TODO delete queries from ctx chat
        });

        this.bot.command('menu', async ctx => {
            ctx.reply("In dev");
            if (ctx.manager.isAdmin) {

            } else {

            }
        });

        this.bot.command('chats', ctx => {
            ctx.reply("In dev");
            if (ctx.manager.isAdmin) {

            } else {

            }
        });

        this.bot.command('chat_enter', async ctx => {
            let chatHash = ctx.message.text.slice('chat_enter'.length);
            // avoiding ts warning
            if (this.chatService.enterChat(chatHash, ctx.manager)) {
                await ctx.manager.linkToChat(chatHash)
                ctx.reply("Now you are in chat with customer");
            } else {
                ctx.reply("Selected chat expired");
            }
        })

        this.bot.action(/chat_enter*/, async (ctx, next)=> {
            let chatHash = ctx.match.input.slice('chat_enter'.length);
            // avoiding ts warning
            if (this.chatService.enterChat(chatHash, ctx.manager)) {
                await ctx.manager.linkToChat(chatHash);
                ctx.reply("Now you are in chat with customer").then(() => next());
            } else {
                ctx.reply("Selected chat expired").then(() => next());
            }
        });

        this.bot.command('close', async ctx => {
            if (ctx.manager.linkedChat) {
                await this.chatService.closeChat(ctx.manager.linkedChat);
                await ctx.manager.unlinkChat();
                ctx.reply("Chat successfuly closed");
            } else {
                ctx.reply("Close chat command will be avalible only after entering any chat");
            }
        });

        this.bot.command('leave', async ctx => {
            if (ctx.manager.linkedChat) {
                await this.chatService.leaveChat(ctx.manager.linkedChat);
                await ctx.manager.unlinkChat();
                ctx.reply("Chat successfuly leaved, " + (await Chat.findOne({ managerId: ctx.manager.userId }))!.initiator + " will wait for another manager");
            } else {
                ctx.reply("Leave chat command will be avalible only after entering any chat");
            }
        });

        this.bot.on('text', async ctx => {
            if (ctx.manager.linkedChat) {
                this.chatService.answerTo(ctx.manager.linkedChat, {
                    id: 0, // deligate to chatService TODO use OMIT to remove this field
                    stamp: ctx.message.date,
                    from: {
                        name: ctx.manager.name,
                        type: 'manager',
                        userid: ctx.manager.userId
                    },
                    text: ctx.message.text
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
            .then(async e => {
                if (!e) {
                    Database.managers.insertOne({
                        isAdmin: true,
                        name: "Admin",
                        userId: Config().bot.admin_id,
                        linkedChat: null,
                        online: false,
                        avatar: (await Database.files.getDefaultAvatar()).file_id
                    })
                }
            })
            .then(async () => {
                this.bot.launch()
                    .then(async () => {
                        this.running = true;
                        for (let mngr of await Manager.findMany({  })) {
                            this.bot.telegram.sendMessage(mngr.userId, "Service now online");
                            this.bot.telegram.sendSticker(mngr.userId, this.stickers.happy);
                        }
                        console.log("Telegram-bot service started");
                    })
                    .catch(err => { throw err });
                this.chatService.start().catch(err => { throw err });
            })
            .catch((e) => {
                console.error("Cannot initialize telegram chat bot service: ", e);
                throw e;
            })
    }

    async stop() {
        if (!this.running) return;
        this.running = false;

        let mngrs = Database.managers.documents;
        for (let m of mngrs) {
            await this.bot.telegram.sendMessage(m.userId, "Service going offline, your status will be reseted to offline");
            await this.bot.telegram.sendSticker(m.userId, this.stickers.verySad);
        }
        this.bot.stop();
        await Database.managers.updateMany({ online: true }, { online: false, linkedChat: null });
        await Database.managers.save();
        await this.chatService.stop();
        await this.onStop();
    }

    private createEnterChatMarkup(hash: string) {
        return tg.Markup.inlineKeyboard([ tg.Markup.button.callback("Accept", "chat_enter" + hash),
                                          tg.Markup.button.callback("Decline", "chat_decline " + hash) ])
    }
}

