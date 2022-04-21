const VERSION = "v0.1.2 beta";
const botName = "Shady " + VERSION;
const userIconPath = "/rediirector/hosting-side/images/avatars/user-icon.png";
const botIconPath = "/rediirector/hosting-side/images/avatars/bot-icon.png";
const notifySound = new Audio("/rediirector/hosting-side/sounds/chat-notify.mp3");

let g_chat: Chat;

interface cookieOptions {
    Domain?: string,
    Path?: string,
    Expires?: string,
    Size?: number,
    HttpOnly?: boolean,
    Secure?: boolean,
    SameSite?: string
};

interface ChatMessageButton {
    name: string,
    value: string,
};

// danger global config

let chatToggleStillHovered  = false;
let chatToggleAlreadyOpened = false;

type Listener = (...args: any[]) => void
type Events = { [event: string]: Listener[]  };

// use https://gist.github.com/mudge/5830382
class EventEmitter {
    private readonly events: Events = {};

    constructor() {
    }

    public on(event: string, listener: Listener): () => void {
        if(typeof this.events[event] !== 'object') this.events[event] = [];

        this.events[event].push(listener);
        return () => this.removeListener(event, listener);
    }

    public removeListener(event: string, listener: Listener): void {
        if(typeof this.events[event] !== 'object') return;
        const idx: number = this.events[event].indexOf(listener);
        if(idx > -1) this.events[event].splice(idx, 1);
    }

    public removeAllListeners(): void {
        Object.keys(this.events).forEach((event: string) => 
                                         this.events[event].splice(0, this.events[event].length)
                                        );
    }

    public emit(event: string, ...args: any[]): void {
        if(typeof this.events[event] !== 'object') return;
        this.events[event].forEach(listener => listener.apply(this, args));
    }

    public once(event: string, listener: Listener): void {
        const remove: (() => void) = this.on(event, (...args: any[]) => {
            remove();
            listener.apply(this, args);
        });
    }
}

jQuery.fn['onPositionChanged'] = function (trigger, millis) {
    if (millis == null) millis = 100;
    var o = $(this[0]); // our jquery object
    if (o.length < 1) return o;

    var lastPos = null;
    var lastOff = null;
    setInterval(function () {
        if (o == null || o.length < 1) return o; // abort if element is non existend eny more
        if (lastPos == null) lastPos = o.position();
        if (lastOff == null) lastOff = o.offset();
        var newPos = o.position();
        var newOff = o.offset();
        if (lastPos.top != newPos.top || lastPos.left != newPos.left) {
            $(this).trigger('onPositionChanged', { lastPos: lastPos, newPos: newPos  });
            if (typeof (trigger) == "function") trigger(lastPos, newPos);
            lastPos = o.position();
        }
        if (lastOff.top != newOff.top || lastOff.left != newOff.left) {
            $(this).trigger('onOffsetChanged', { lastOff: lastOff, newOff: newOff });
            if (typeof (trigger) == "function") trigger(lastOff, newOff);
            lastOff= o.offset();
        }
    }, millis);

    return o;
};

function getCookie(name: string) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

function setCookie(name: string, value: string, options?: cookieOptions) {
    let doptions: cookieOptions = {
        Path: '/',
        Secure: true,
        SameSite: "none"
    };

    let l_options: cookieOptions = {
        ...doptions,
        ...options,
    }

    let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);
    for (let optionKey in l_options) {
        updatedCookie += "; " + optionKey;
        let optionValue = l_options[optionKey];
        if (optionValue !== true) {
            updatedCookie += "=" + optionValue;
        }
    }
    document.cookie = updatedCookie;
}

function deleteCookie(name) { setCookie(name, "", { Expires: new Date(-1).toUTCString() }); }

class DragDrop {
    private Active = false;
    private CurrentX: number;
    private CurrentY: number;
    private InitialX: number;
    private InitialY: number;
    private OffsetX = 0;
    private OffsetY = 0;

    private item: JQuery<HTMLElement>;
    private target: JQuery<HTMLElement>;
    private container: JQuery<HTMLElement>;

    constructor( item: JQuery<HTMLElement>, target: JQuery<HTMLElement>, container: JQuery<HTMLElement> = $("body")) {
        this.item = item;
        this.target = target;
        this.container = container;

        this.OffsetX = item.position().left;
        this.OffsetY = item.position().top;

        // @ts-ignore
        this.item.onPositionChanged(this.updateOffset.bind(this));

        this.container.on("touchstart", this.dragStart.bind(this));
        this.container.on("touchend",   this.dragEnd.bind(this));
        this.container.on("touchmove",  this.drag.bind(this));

        this.container.on("mousedown",  this.dragStart.bind(this));
        this.container.on("mouseup",    this.dragEnd.bind(this));
        this.container.on("mousemove",  this.drag.bind(this));
    }

    private dragStart(e) {
        if (e.type === "touchstart") {
            this.InitialX = e.touches[0].clientX - this.OffsetX;
            this.InitialY = e.touches[0].clientY - this.OffsetY;
        } else {
            this.InitialX = e.clientX - this.OffsetX;
            this.InitialY = e.clientY - this.OffsetY;
        }

        if (e.target === this.target[0]) {
            // lock page scroll
            $("html").addClass("-is-locked");

            this.item.removeClass('drag-notactive');
            this.item.addClass('drag-active');
            this.Active = true;
        }
    }

    private dragEnd(e) {
        this.InitialX = this.CurrentX;
        this.InitialY = this.CurrentY;

        this.Active = false;

        // activate scroll
        $("html").removeClass("-is-locked");

        this.item.removeClass('drag-active');
        this.item.addClass('drag-notactive');
    }

    private updateOffset(e) {
        this.OffsetX = e.left;
        this.OffsetY = e.top;
    }

    private drag(e) {
        if (this.Active) {
            e.preventDefault();

            if (e.type === "touchmove") {
                this.CurrentX = e.touches[0].clientX - this.InitialX;
                this.CurrentY = e.touches[0].clientY - this.InitialY;
            } else {
                this.CurrentX = e.clientX - this.InitialX;
                this.CurrentY = e.clientY - this.InitialY;
            }

            this.OffsetX = this.CurrentX;
            this.OffsetY = this.CurrentY;

            this.item.css("left", this.CurrentX);
            this.item.css("top", this.CurrentY);
        }
    }
};

class Companion extends EventEmitter {
    ask(text: string) {
    }
}

interface botMessage {
    text: string,
    buttons?: ChatMessageButton[],
}

const botMessages: Record<string, botMessage> = {
    startup:           { text: 'Я - ' + botName },
    enterName:         { text: "Как к вам обращаться?" },
    returnToManager:   { text: "Тут я бессилен, вызываю оператора." },
    waitForManager:    { text: "Пожалуйста, подождите, вам скоро ответят." },
    chatClosed:        { text: "Чат закрыт, надеюсь мы помогли вам." },
    managerLeaved:     { text: "Менеджер вышел из чата, ищем вам другого." },
    historyTurnDelete: { text: "Сообщения больше не будут сохраняться в историю" },
    historyTurnSave:   { text: "Сообщения будут сохраняться в историю" },
    internalError:     { text: "Ой-ой. Что то пошло не так, пожалуйста, презагрузите страницу." },
    serviceNotAvalible:{ text: "Сервис временно не доступен." },
    whatBotCan:        { text: "Я умею:</br>Вызывать оператора</br>...В разработке..." },

    botCommands: {
        text: "Чем буду полезен?",
        buttons: [
            { name: "Список возможностей", value: "_showWhatBotCan" },
            { name: 'Вызвать оператора',   value: '_callManager'  }
        ]
    },
}

class Bot extends Companion {
    private onEnteringName: boolean = false; // trigger to redirect next user message to them name

    constructor(startMessage?: botMessage) {
        super();
        console.log("Bot online");

        if (startMessage) {
            this.appendMessage(startMessage);
        }
        $("#chat-manager-name").text(botName);

        if (!getCookie('customerName')) {
            this.appendMessage(botMessages.enterName);
            this.onEnteringName = true;
        } else {
            this.appendMessage(botMessages.botCommands);
        }
    }

    private appendMessage(msg: botMessage) {
        Chat.appendMessage(
            {
                message: {
                    id: -1,
                    from: 'bot',
                    text: msg.text,
                    creator: botName,
                    time: new Date().getTime()
                },
                buttons: (msg.buttons ? msg.buttons : null)
            }
        )
    }

    ask(text: string) {
        let msg: ChatMessage;
        if (this.onEnteringName) { // setup client name
            setCookie('customerName', text);
            this.onEnteringName = false;
            this.appendMessage(botMessages.botCommands);
        } else { // answer
            this.appendMessage(botMessages.returnToManager);
            this.emit('managerReq');
            // process logic
        }
        return msg;
    }
}

class Reactor extends EventEmitter {
    protected url: string;
    protected socket: WebSocket;

    constructor() {
        super();
        this.url = "wss://f7cb-185-253-102-98.ngrok.io/ws";
        console.log("Reactor connecting to ", this.url);
        this.socket = new WebSocket(this.url);

        this.socket.onerror = (e) => {
            this.emit("error");
        }
        this.socket.onclose = (e) => {
            switch (e.code) {
                case 1000:
                    this.emit("shutdown");
                    break;
                case 1011:
                    this.emit("error");
                    break;
                case 1014:
                    this.emit("notAvalible");
                    break;
                default:
                    this.emit("shutdown");
            }
        }
        this.socket.onopen = () => {
            console.log("Reactor online");
            this.emit("ready");
            this.socket.send(JSON.stringify({ hash: getCookie("chatHash") }));
        }
        this.socket.onmessage = (ev: MessageEvent<string>) => {
            let data: ServerMessage = JSON.parse(ev.data.toString());
            console.log(data);
            switch (data.event) {
                case "created":
                    // @ts-ignore
                    setCookie("chatHash", data.payload.hash);
                    break;
                case "restored":
                    console.log("restored TODO");
                    break;
                case "answer":
                    // @ts-ignore
                    this.emit("answer", data.payload.message);
                    break;
                case "accepted":
                    // @ts-ignore
                    this.emit("accepted", data.payload.manager);
                    break;
                case "leaved":
                    this.emit("leaved", data.payload);
                    break;
                default:
                    console.log("Unknown data from server: ", data)
            }
        }
    }

    deconstructor() {
        this.disconnect();
    }

    disconnect() {
        this.socket.close();
    }

    sendMessage(msg: ChatMessage) {
        this.socket.send(JSON.stringify({
            event: "message",
            data: {
                message: msg
            }
        }));
    }
}

class Manager extends Companion {
    private connected: boolean = false;
    private reactor: Reactor;

    constructor() {
        super();
        console.log("Manager online");
        this.reactor = new Reactor();

        this.reactor.on("accepted", (name: string) => {
            $("#chat-manager-name").text(name);
            notifySound.play();
        });

        this.reactor.on("leaved", () => {
            notifySound.play();
            this.emit("ManagerLeaved");
        });

        this.reactor.on("closed", () => {
            notifySound.play();
            this.emit("ClosedByManager");
        });

        this.reactor.on("created", (hash: string) => {
            setCookie("chatHash", hash)
        });

        this.reactor.on("restored", (manager: string) => {
            console.log("WARN not implemented restored func")
        });

        this.reactor.on("answer", (msg: ChatMessage) => {
            notifySound.play();
            Chat.appendMessage({ message: msg });
        });
    }

    deconstructor() {

    }

    ask(text: string) {
        let msg: ChatMessage;
        this.reactor.sendMessage({
            id: -1,
            from: 'customer',
            creator: getCookie('customerName'),
            text: text,
            time: new Date().getTime()
        });
        return msg;
    }
}

class ChatButton extends EventEmitter {
    private stillHovered = false;
    private opened = false;

    constructor() {
        super();
        // TODO move to ChatSettings class
        $("#chat-save-session").on("click", () => {
            // TODO move to functions
            if (getCookie("saveChatSession") == "true") {
                setCookie("saveChatSession", "false");
                $("#chat-save-session").removeClass("chat-settings-active");
                $("#chat-save-session").addClass("chat-settings-diactive");
                // botMessages.historyTurnDelete();
            } else {
                setCookie("saveChatSession", "true");
                $("#chat-save-session").removeClass("chat-settings-diactive");
                $("#chat-save-session").addClass("chat-settings-active");
                // botMessages.historyTurnSave();
            }
        });

        $("#chat-reset").on("click", () => this.emit("reset"));
        $("#chat-toggle").hover(
            e => {
                this.stillHovered = true;
                if (this.opened) {
                    this.show();
                } else {
                    setTimeout(() => {
                        if (this.stillHovered) {
                            this.opened = true
                            this.show();
                        }
                    }, 1050)
                }
            }, e => {
                this.stillHovered = false;
                this.hide();
            }
        );

        $("#chat-toggle-text").on("click", ev => this.emit("toggle"));

        // hide
        $("#chat-toggle").css("left", -$("#chat-toggle").width());
        // show
        this.adjust(1000);
    }

    show() {
        $("#chat-toggle").stop().animate({ left: 0 }, 1500, "easeInOutQuint"); // TODO adjust duration by showed width
    }

    hide() {
        $("#chat-toggle").stop().animate({ left: this.normalLeft }, 2000, "easeOutCubic", () => { this.opened = false; });
    }

    get normalLeft(): number {
        return $("#chat-toggle-text").width() - $("#chat-toggle").width() + 4;
    }

    adjust(time = 0): void {
        $("#chat-toggle").animate({left: this.normalLeft}, time);
    }

}

// TOO EXTRA LARGE
class Chat {
    private companion: Companion;

    private whileSending: boolean = false;
    static lastMessageId: number = 0; // local message id, will not be synced with server
    static chatHistory: Array<ChatMessage> = new Array();

    private resizeLock: boolean = false;
    private hidden: boolean = false;
    readonly initialPosition = $("#chat-box").position();
    readonly initialSize = { height: $("#chat-box").innerHeight(), width: $("#chat-box").innerWidth() };

    private button: ChatButton;

    constructor() {
        this.button = new ChatButton();
        this.button.on('reset', () => this.resetChat());
        this.button.on('toggle', () => this.toggle());
        // send buttons
        $('#chat-input').bind('keyup', (event) => { if (event.keyCode == 13) this.handleUserInput(event); });
        $("#chat-submit").on("click", this.handleUserInput);

        // chat drag
        new DragDrop($("#chat-box"), $("#chat-box-header"));

        this.selectBackground();
        this.setStratigy();
        this.setupChatResize();

        this.companion.on("managerReq", () => {
            this.companion = new Manager();
        })
        this.companion.on("ManagerLeaved", () => {
            this.companion = new Bot(botMessages.managerLeaved);
        });
        this.companion.on("ClosedByManager", () => {
            this.companion = new Bot(botMessages.chatClosed);
        });
        this.companion.on("NotAvalible", () => {
            this.companion = new Bot(botMessages.serviceNotAvalible);
        });
        this.companion.on("error", () => {
            this.companion = new Bot(botMessages.internalError);
        })

        // show chat
        $("#chat-box").animate({opacity: 1}, 1000);
    }

    public hide() {
        this.hidden = true;
        $("#chat-box")
            .stop()
            .animate({
                left: -$("#chat-box").width() - this.initialPosition.left,
                top: this.initialPosition.top,
                height: "toggle",
                width: "toggle"
            }, 1000, "easeOutQuad");
    }

    public show() {
        this.hidden = false;
        $("#chat-box")
            .stop()
            .animate({
                left: this.initialPosition.left,
                top: this.initialPosition.top,
                height: "toggle",
                width: "toggle"
            }, 1000, "easeOutQuad");
    }

    public toggle() {
        if (this.hidden) {
            this.show();
        } else {
            this.hide();
        }
    }

    private selectBackground() {
        let bg = getCookie('chatBackground');
        if (bg) {
            $("#chat-box-body").css("background-image", bg);
        } else {
            let rand = (min, max) => Math.round(Math.random() * (max - min) + min);
            $("#chat-box-body")
                .css("background-image",
                     "url(/rediirector/hosting-side/images/backgrounds/chat-background-"+2+".png)");
        }

    }

    private setStratigy() {
        if (getCookie("saveChatSession") == "true") {
            $("#chat-save-session").addClass("chat-settings-active");
            this.loadChatHistory();
        } else {
            setCookie("saveChatSession", "false");
            $("#chat-save-session").addClass("chat-settings-diactive");
            this.companion = new Bot(botMessages.startup);
        }
    }

    private resizeChat(size: { width: number, height: number }, dur: number = 0, then = null) {
        $("#chat-logs").animate({
            height: size.height -
                    $("#chat-box-header")[0].offsetHeight -
                    $("#chat-input")[0].offsetHeight
        }, dur, then);
        $("#chat-box").animate({
            width: size.width,
            height: size.height
        }, dur, then);
    }

    private setupChatResize() {
        // reset to default
        this.resizeChat({ width: $("#chat-box").width(), height: $("#chat-box").height() });
        $("#chat-vertical-normal").css("display", "none");

        // chat resizing buttons
        $("#chat-vertical-maximize").on("click", () => {
            if (!this.resizeLock) {
                this.resizeLock = true;
                $("#chat-vertical-maximize").css("display", "none");
                $("#chat-vertical-normal").css("display", "block");

                $("#chat-box").animate(
                    {
                        top: 0,
                        left: 6
                    }, 500,
                    () => {
                        this.resizeChat(
                            {
                                width: $("#chat-box").width(),
                                height: window.innerHeight
                            }, 1000,
                            () => {
                                this.resizeLock = false;
                            });
                    }
                );
            }
        });
        $("#chat-vertical-normal").on("click", () => {
            if (!this.resizeLock) {
                this.resizeLock = true;
                $("#chat-vertical-maximize").css("display", "block");
                $("#chat-vertical-normal").css("display", "none");

                this.resizeChat(
                    {
                        width: this.initialSize.width,
                        height: this.initialSize.height
                    }, 1000,
                    () => $("#chat-box").animate(
                        {
                            top: this.initialPosition.top,
                            left: this.initialPosition.left
                        }, 500,
                        () => {
                            this.resizeLock = false;
                        })
                );
            }
        });
    }

    // handleButtonClick(name, value, messageId) {
    //     $("#cm-msg-" + messageId +" .cm-msg-button").remove();
    //     Chat.appendMessage({ message: { text: name, from: 'customer', id: -1, time: new Date().getTime(), creator: "Customer" } });

    //     switch (value) {
    //         case "_callManager":
    //             // TODO add msg
    //             Chat.appendMessage({text: "Вызываю оператора", from: 'b'});
    //             returnToManager();
    //             break;
    //         case "_showWhatBotCan":
    //             botMessages.whatBotCan();
    //             break;
    //     }

    //     // TODO remove buttons from chatHistory
    // }

    handleUserInput(event) {
        let msg: string = <string>$('#chat-input').val();
        if (msg.length > 0) {
            Chat.appendMessage({
                message: {
                    id: -1,
                    creator: "Customer",
                    time: new Date().getTime(),
                    from: "customer",
                    text: msg
                }});
            $("#chat-input").val('');
            this.companion.ask(msg);
        }
    }

    static appendMessage(arg: {message: ChatMessage, buttons?: ChatMessageButton[]}, save = true) {
        let type: string;
        switch (arg.message.from) {
            case "manager": {
                if (arg.message.creator == null) {
                    arg.message.creator = 'Менеджер';
                }
                type = "user";
                break;
            }
            case "bot": {
                arg.message.creator = botName;
                arg.message.avatarUrl = botIconPath;
                type = "user";
                break;
            }
            case "customer": {
                if (getCookie("customerName")) {
                    arg.message.creator = getCookie("customerName");
                } else {
                    arg.message.creator = "Customer";
                }
                arg.message.avatarUrl = userIconPath;
                type = "self";
                break;
            }
            default: {
                console.log("appendMessage: passed unknown msgFrom value - ", arg.message.from);
                return; // TODO return error msg, handle err
            }
        }
        let time = new Date(arg.message.time).toLocaleTimeString();

        Chat.lastMessageId++;
        arg.message.id = Chat.lastMessageId;
        if (save === true) {
            this.chatHistory.push(arg.message);
        }

        let str =
                "<div id='cm-msg-" + arg.message.id + "' class=\"chat-msg " + arg.message.from + " " + type + "\">" +
                    "<span class=\"msg-avatar\">" +
                        "<img src=\"" + arg.message.avatarUrl + "\">" +
                    "<\/span>" +
                    "<div class=\"cm-msg-text\">" +
                        arg.message.text +
                        "<div class=\"cm-msg-time\">" +
                            time +
                        "<\/div>" +
                    "<\/div>";

        if (arg.buttons) {
            // btn-primary chat-btn
            str +=  "<div class=\"cm-msg-button\">" +
                        "<ul>" +
                            arg.buttons.map(button =>
                            "<li class=\"button\">" +
                                "<span onclick=\"handleButtonClick(\'" + button.name + "\',\'" + button.value + "\', \'" + Chat.lastMessageId + "\')\" class=\"chat-button\"\">" +
                                    button.name +
                                "<\/span>" +
                            "<\/li>"
                        ).join('') +
                        "<\/ul>" +
                    "<\/div>";
        }
        str +=
                "<\/div>";

        $('#chat-logs').append(str);
        $("#cm-msg-"+Chat.lastMessageId).hide().fadeIn(300);
        $("#chat-logs").stop().animate({ scrollTop: $("#chat-logs")[0].scrollHeight }, 1000);
    }

    saveChatHistory(): void { localStorage.setItem("chatHistory", JSON.stringify(Chat.chatHistory)); }

    // maybe use indexedDb instead?
    loadChatHistory(): void {
        let messages: string = localStorage.getItem("chatHistory");
        if (messages) {
            Chat.chatHistory = JSON.parse(messages);
            if (Chat.chatHistory.length > 0) {
                Chat.chatHistory.forEach(m => Chat.appendMessage({ message: m }, false));

                if (getCookie("managerName")) {
                    if (getCookie("chatHash")) {
                        $("#chat-manager-name").text(getCookie("managerName"));
                        this.companion = new Manager();
                    } else {
                        this.companion = new Bot();
                    }
                }
            } else {
                this.companion = new Bot();
            }
        } else {
            this.companion = new Bot();
        }
    }

    resetChat(): void {
        localStorage.removeItem("chatHistory");
        Chat.lastMessageId = 0;
        Chat.chatHistory = [];
        deleteCookie("chatHash");
        deleteCookie("customerName");
        deleteCookie("managerName");
        $(".chat-msg").each(function(i, itm) { // TODO add animation
            $(this).remove();
        });
        this.companion = new Bot();
    }
}

window.onload = () => { g_chat = new Chat(); };

// delete chat session if started
window.onunload = () => {
    if (getCookie("saveChatSession") == "false") {
        g_chat.resetChat();
    } else {
        g_chat.saveChatHistory();
    }
}
