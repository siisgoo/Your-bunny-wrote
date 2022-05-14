import * as tg from 'telegraf'
import { EventEmitter } from 'events'
import { Database, Manager, Chat } from './database.js'
import { ChatServer } from './ChatService.js'
import { Config } from './Config.js'

interface Context extends tg.Context {
    manager: Manager
}

type TextContext = tg.NarrowedContext<Context, tg.Types.MountMap['text']>;
const commands = (()=> {
    async function start(this: BotService, ctx: TextContext) {
        ctx.reply("Yo, how you are?");
        // ctx.replyWithSticker(this.stickers.welcoming);
    }

    async function help(this: BotService, ctx: TextContext) {
        ctx.reply("In dev");
    }

    async function chatenter(this: BotService, ctx: TextContext) {
        let chatHash = ctx.message.text.slice('chat_enter'.length);
        // avoiding ts warning
        if (this.chatService.enterChat(chatHash, ctx.manager)) {
            await ctx.manager.linkToChat(chatHash)
            ctx.reply("Now you are in chat with customer");
        } else {
            ctx.reply("Selected chat expired");
        }
    }

    async function close(this: BotService, ctx: TextContext) {
        if (ctx.manager.linkedChat) {
            await this.chatService.closeChat(ctx.manager.linkedChat);
            await ctx.manager.unlinkChat();
            ctx.reply("Chat successfuly closed");
        } else {
            ctx.reply("Close chat command will be avalible only after entering any chat");
        }
    }

    async function leave(this: BotService, ctx: TextContext) {
        if (ctx.manager.linkedChat) {
            ctx.reply("Chat successfuly leaved, " + (await Chat.findOne({ managerId: ctx.manager.userId }))!.initiator + " will wait for another manager");
            await this.chatService.leaveChat(ctx.manager.linkedChat);
            await ctx.manager.unlinkChat();
        } else {
            ctx.reply("Leave chat command will be avalible only after entering any chat");
        }
    }

    async function history(this: BotService, ctx: TextContext) {
        ctx.reply("In dev");
    }

    async function setname(this: BotService, ctx: TextContext) {
        let name = "";
        if (ctx.message && ctx.message.text) {
            name = String(ctx.message.text.slice('setname'.length+2)).trim();
        }
        if (name !== "") {
            await ctx.manager.setName(name);
            ctx.reply("Now your will called " + name);
        } else {
            ctx.reply('No string passed, try: "/setname The Emperor"');
        }
    }

    async function updateavatar(this: BotService, ctx: TextContext) {
        let photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
        let file = await ctx.telegram.getFile(photos.photos[0][0].file_id);
        let url = await ctx.telegram.getFileLink(file.file_id);
        let l_file = await Database.files.saveFile(url.href, "avatars");
        if (l_file) {
            await ctx.manager.setAvatar(l_file.file_id);
        } else {
            ctx.reply("Loading error. Try another time");
        }
    }

    async function chats(this: BotService, ctx: TextContext) {
        ctx.reply("In dev");
    }

    async function menu(this: BotService, ctx: TextContext) {
        ctx.reply("In dev");
        if (ctx.manager.isAdmin) {

        } else {

        }
    }

    async function goonline(this: BotService, ctx: TextContext) {
        if (ctx.manager.linkedChat) {
            ctx.reply("You cannot change status while you are in chat");
        } else {
            await ctx.manager.setOnline(true);
            ctx.reply("You are online now");
            // ctx.replyWithSticker(this.stickers.happy)

            let pending = await Database.chats.findMany((ch) => { return !ch.managerId && ch.online && ch.waitingManager });
            if (pending.length > 0) {
                await ctx.reply("During your absence " + pending.length + " peoplec need your help");
                for (let chat of pending) {
                    ctx.reply("Incoming invetation from " + chat.initiator, this.createEnterChatMarkup(chat.hash));
                }
            }
        }
    }

    async function gooffline(this: BotService, ctx: TextContext) {
        if (ctx.manager.linkedChat) {
            ctx.reply("You cannot change status while you are in chat");
        } else {
            await ctx.manager.setOnline(false);
            ctx.reply("You are offline now");
            // ctx.replyWithSticker(this.stickers.sad);
        }
    }

    async function status(this: BotService, ctx: TextContext) {
        let chatLinkInfo: string = (ctx.manager.linkedChat ? " and you in chat" : "");
        ctx.reply("Your status: " + (ctx.manager.online ? "online" : "offline") + chatLinkInfo)
    }

    return {
        status,
        goonline,
        gooffline,
        menu,
        chats,
        updateavatar,
        setname,
        history,
        leave,
        close,
        chatenter,
        start,
        help,
    }
})()

const cb_data = {
    approveRequest: 'approve_request',
    approveManager: 'approve_manager',
    rejectManager: 'reject_manager',
    chatEnter: 'chat_enter',
};

type CqContext = tg.NarrowedContext<Context & { match: RegExpExecArray; }, tg.Types.MountMap['callback_query']>;
let actions = (() => {

    async function approverequest(this: BotService, ctx: CqContext, next: () => void) {
        let id = ctx.match.input.slice(cb_data.approveRequest.length);
        let keyboard = tg.Markup.inlineKeyboard([ [
            {   text: "Approve",
                callback_data: cb_data.approveManager + " " + id },
            {   text: "Reject",
                callback_data: cb_data.rejectManager + " " + id }
        ] ])
        await ctx.telegram.sendMessage(Config().bot.admin_id, "Autorization request from @" + ctx.from!.username,
                                       keyboard);
        next();
    }

    async function approvemanager(this: BotService, ctx: CqContext, next: () => void) {
        let userId = Number(ctx.match.input.slice(cb_data.approveManager.length));
        let member = await this.bot.telegram.getChatMember(userId, userId);
        await (new Manager({
            userId: userId,
            name: member.user.first_name + " " + member.user.last_name,
            avatar: (await Database.files.getDefaultAvatar()).file_id
        })).sync();

        await this.bot.telegram.sendMessage(userId, "Your request have been accepted. Now you are can use this bot");
        next();
    }

    async function rejectmanager(this: BotService, ctx: CqContext, next: () => void) {
        let userId = Number(ctx.match.input.slice(cb_data.rejectManager.length));
        await this.bot.telegram.sendMessage(userId, "Your request have been rejected");
        // this.bot.telegram.sendSticker(userId, this.stickers.evil);
        next();
    }

    async function chatenter(this: BotService, ctx: CqContext, next: () => void) {
        let chatHash = ctx.match.input.slice(cb_data.chatEnter.length);
        // avoiding ts warning
        if (this.chatService.enterChat(chatHash, ctx.manager)) {
            await ctx.manager.linkToChat(chatHash);
            await ctx.reply("Now you are in chat with customer");
        } else {
            await ctx.reply("Selected chat expired");
        }
        next();
    }

    async function text(this: BotService, ctx: TextContext) {
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
    }

    return {
        approverequest,
        approvemanager,
        rejectmanager,
        chatenter,
        text,
    }
})()

const csAction = (() => {

    async function managerrequest(this: BotService, chat: Chat) {
        if (chat.managerId) {
            await this.bot.telegram.sendMessage(chat.managerId, "Customer " + chat.initiator + " return to chat");
        } else {
            let online = await Database.managers.findMany({ online: true, linkedChat: null });
            for await (let m of online) {
                this.bot.telegram.sendMessage(m.userId, "Incoming chat invetation from " + chat.initiator, this.createEnterChatMarkup(chat.hash));
            }
        }
    }

    async function closed(this: BotService, args: any) {
        let { chat, waitReq } = args;
        if (chat.managerId) {
            if (waitReq) {
                this.bot.telegram.sendMessage(chat.managerId, "Client reloading page or something, you still can leave or close this chat");
            } else {
                this.bot.telegram.sendMessage(chat.managerId, "Client closed chat");
                await (await Manager.findOne({ userId: chat.managerId }))!.unlinkChat();
                await chat.unlinkManager();
            }
        }
    }

    async function message(this: BotService, args: any) {
        let { chat, message } = args;
        if (chat.managerId) {
            // this.bot.telegram.sendMessage(chat.managerId, message.from.name + ":\n" + message.text);
            this.bot.telegram.sendMessage(chat.managerId, chat.initiator + ":\n" + message.text);
        }
    }

    return {
        managerrequest,
        closed,
        message,
    }
})()

export class BotService extends EventEmitter {
    public readonly bot: tg.Telegraf<Context>;
    public readonly chatService: ChatServer;

    private running: boolean = false;

    public onStop: () => void = () => {}

    // private readonly stickers = {
    //     welcoming: "CAACAgIAAxkBAAEEh85iYatAqlMz81qfn7Dk303ummYrjwACGBEAAvE40EoZjSpXJ-H1-CQE",
    //     happy:     "CAACAgIAAxkBAAEEh9BiYatNE-M0LO7eJ6A8rERHIennowAC9A8AAuauOUpmEnHaU53szyQE",
    //     sad:       "CAACAgIAAxkBAAEEh9ZiYavBfd0mfaBWTzqMeBSYbwkB7wACjxMAAosj2UpwO-yY639C-iQE",
    //     evil:      "CAACAgIAAxkBAAEEh9JiYate-8ItpkQBSCowdGmwTHzR8wAC0hEAAjnxkUtIXF3Fd0t44iQE",
    //     verySad:   "CAACAgIAAxkBAAEEh9RiYaueiAN4zPax481xTRns1EYlRQAC0hAAAtOfOEp18SByrhUeJiQE",
    // }

    constructor() {
        super();
        this.chatService = new ChatServer();

        this.chatService.on('managerRequest', (arg) => csAction.managerrequest.call(this, arg));
        this.chatService.on('chatClosed',     (arg) => csAction.closed.call(this, arg));
        this.chatService.on('chatMessage',    (arg) => csAction.message.call(this, arg));

        this.bot = new tg.Telegraf(Config().bot.token);

        this.bot.use(async (ctx, next) => {
            let mngr = await Manager.findOne({ userId: ctx.from!.id })
            if (mngr) {
                ctx.manager = mngr;
                return next();
            } else if (ctx.updateType == 'callback_query') {
                return next();
            } else {
                ctx.replyWithMarkdown("Welcome to rediirector bot. To start using bot you need to be aproved by bot adimnistraton.\n" +
                                      "Full documentation represents [here](https://github.com/siisgoo/rediirector/blob/main/docs/index.md)");
                ctx.reply("Click on button for send approve request",
                          tg.Markup.inlineKeyboard([ [ { text: "Send", callback_data: "approve_request " + ctx.from!.id  }, ] ]));
            }
        })

        this.bot.start(commands.start)
        this.bot.command('status',       (ctx) => commands.status.call(this, ctx));
        this.bot.command('setname',      (ctx) => commands.setname.call(this, ctx));
        this.bot.command('updateavatar', (ctx) => commands.updateavatar.call(this, ctx));
        this.bot.command('goonline',     (ctx) => commands.goonline.call(this, ctx));
        this.bot.command('gooffline',    (ctx) => commands.gooffline.call(this, ctx));
        this.bot.command('menu',         (ctx) => commands.menu.call(this, ctx));
        this.bot.command('chats',        (ctx) => commands.chats.call(this, ctx));
        this.bot.command('chat_enter',   (ctx) => commands.chatenter.call(this, ctx));
        this.bot.command('close',        (ctx) => commands.close.call(this, ctx));
        this.bot.command('leave',        (ctx) => commands.leave.call(this, ctx));

        this.bot.action(RegExp(cb_data.approveRequest + "*"), (ctx, next) => actions.approverequest.call(this, ctx, next));
        this.bot.action(/approve_manager*/,                   (ctx, next) => actions.approvemanager.call(this, ctx, next));
        this.bot.action(/reject_manager*/,                    (ctx, next) => actions.rejectmanager.call(this, ctx, next));
        this.bot.action(RegExp(cb_data.chatEnter + "*"),      (ctx, next) => actions.chatenter.call(this, ctx, next));

        // Its muts be declared after ALL commands
        this.bot.on('text', actions.text.bind(this));
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
                            // this.bot.telegram.sendSticker(mngr.userId, this.stickers.happy);
                        }
                        console.log("Telegram-bot service started");
                    })
                    .catch(err => { throw err });
                this.chatService.start().catch(err => { throw err });
            })
            .catch((e) => {
                throw e;
            })
    }

    async stop() {
        if (!this.running) return;
        this.running = false;

        let mngrs = Database.managers.documents;
        for (let m of mngrs) {
            await this.bot.telegram.sendMessage(m.userId, "Service going offline, your status will be reseted to offline");
            // await this.bot.telegram.sendSticker(m.userId, this.stickers.verySad);
        }
        this.bot.stop();
        await Database.managers.updateMany({ online: true }, { online: false, linkedChat: null });
        await Database.managers.save();
        await this.chatService.stop();
        await this.onStop();
    }

    createEnterChatMarkup(hash: string) {
        return tg.Markup.inlineKeyboard([ tg.Markup.button.callback("Accept", "chat_enter" + hash),
                                          tg.Markup.button.callback("Decline", "chat_decline " + hash) ])
    }
}
