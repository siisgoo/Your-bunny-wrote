import { ClientChatMessage, ChatMessage } from 'Schemas'

const VERSION = "v0.1.2 beta";
const botName = "Shady " + VERSION;

type ChatAppendMessage = {message: ChatMessage, buttons?: ChatMessageButton[]};

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

window['isMobile'] = false;
if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os )?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip )|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/ )|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/ )|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w] )|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0,4))) {
    window['isMobile'] = true;
}

// Object.defineProperty(jQuery.fn, 'onPositionChanged', function (trigger, millis) {
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
// });

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
            if (window['isMobile'])
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
        if (window['isMobile']) $("html").removeClass("-is-locked");

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
class Chat extends EventEmitter {
    lastMessageId: number = 0; // local message id, will not be synced with server
    chatHistory: IndexedDb;

    private resizeLock: boolean = false;
    private hidden: boolean = false;
    readonly initialPosition = $("#chat-box").position();
    readonly initialSize = { height: $("#chat-box").innerHeight(), width: $("#chat-box").innerWidth() };

    private button: ChatButton;

    constructor() {
        super();
        this.button = new ChatButton();
        this.button.on('reset', () => this.resetChat());
        this.button.on('toggle', () => this.toggle());

        this.chatHistory = new IndexedDb("rediirector");

        this.chatHistory.createObjectStore(["history"]);

        // chat drag
        new DragDrop($("#chat-box"), $("#chat-box-header"));

        this.selectBackground();
        this.setupChatResize();

        // show chat
        $("#chat-box").animate({opacity: 1}, 1000);
    }

    deconstructor() {
        if (getCookie("saveChatSession") == "false") {
            this.resetChat();
        }
    }

    public hide() {
        this.hidden = true;
        return $("#chat-box")
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
        return $("#chat-box")
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
                     "url(/rediirector/images/backgrounds/chat-background-"+2+".png)");
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

    public appendMessage(arg: ChatAppendMessage, save = true) {
        let type: string;
        let avatar_url: string;
        switch (arg.message.from.type) {
            case "bot":
                avatar_url = "/rediirector/images/avatars/bot-icon.png"
            break;
            case "manager":
                type = "user";
                // TODO icon load
                break;
            case "customer":
                type = "self";
                avatar_url = "/rediirector/images/avatars/user-icon.png"
                break;
            default:
                console.log("appendMessage: passed unknown msgFrom value - ", arg.message.from);
                return; // TODO return error msg, handle err
        }
        let time = new Date(arg.message.stamp).toLocaleTimeString();

        this.lastMessageId++;
        arg.message.id = this.lastMessageId;
        if (save) this.chatHistory.putValue("history", arg);

        let str =
                "<div id='cm-msg-" + arg.message.id + "' class=\"chat-msg " + type + "\">" +
                    "<span class=\"msg-avatar\">" +
                        "<img src=\"" + avatar_url + "\">" +
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
                                "<span onclick=\"handleButtonClick(\'" + button.name + "\',\'" + button.value + "\', \'" + this.lastMessageId + "\')\" class=\"chat-button\"\">" +
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
        $("#cm-msg-"+this.lastMessageId).hide().fadeIn(300);
        $("#chat-logs").stop().animate({ scrollTop: $("#chat-logs")[0].scrollHeight }, 1000);
    }

        // let messages: string = localStorage.getItem("chatHistory");
        // if (messages) {
        //     this.chatHistory = JSON.parse(messages);
        //     if (Chat.chatHistory.length > 0) {
        //         Chat.chatHistory.forEach(m => this.appendMessage({ message: m }, false));

        //         if (getCookie("managerName")) {
        //             if (getCookie("chatHash")) {
        //                 $("#chat-manager-name").text(getCookie("managerName"));
        //                 this.emit("loadManager");
        //             } else {
        //                 this.emit("loadBot", false)
        //             }
        //         }
        //     } else {
        //         this.emit("loadBot");
        //     }
        // } else {
        //     this.emit("loadBot");
        // }

    public resetChat(): void {
        localStorage.removeItem("chatHistory");
        this.lastMessageId = 0;
        this.chatHistory.drop("history");
        deleteCookie("chatHash");
        deleteCookie("customerName");
        deleteCookie("managerName");
        $(".chat-msg").each(function(i, itm) { // TODO add animation
            $(this).remove();
        });
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

class Bot {
    private onEnteringName: boolean = false; // trigger to redirect next user message to them name

    constructor(startMessage?: botMessage) {
        console.log("Bot online");

        if (startMessage) {
            // this.appendMessage(startMessage);
        }
        $("#chat-manager-name").text(botName);

        if (!getCookie('customerName')) {
            // this.appendMessage(botMessages.enterName);
            this.onEnteringName = true;
        } else {
            // this.appendMessage(botMessages.botCommands);
        }
    }

    say(msg: botMessage): ChatAppendMessage {
        return
            {
                message: {
                    id: 0;
                    stamp: new Date().getDate();
                    from: {
                        type: "bot";
                        name: botName;
                    };
                    text: msg.text;
                };
                buttons: (msg.buttons)
            }
    }

    ask(text: string): ClientChatMessage | null {
        let msg: ClientChatMessage;
        if (this.onEnteringName) { // setup client name
            setCookie('customerName', text);
            this.onEnteringName = false;
            // this.appendMessage(botMessages.botCommands);
        } else { // answer
            // this.appendMessage(botMessages.returnToManager);
            return null;
            // process logic
        }
        return msg;
    }
}

type EventName = "answer" | "accepted" | "leaved" | "created" | "restored" | "closed" | "onlineCount";

type IEvent = {
    name: EventName,
    parameters: object,
    validator: (param: object) => boolean
}

interface EventsMap extends Record<string&EventName, IEvent> {
    "asnwer": {
        name: "answer",
    }
}

type EventHandler<T extends keyof EventsMap> =
    (arg: EventsMap[T]["parameters"]) => void;

const Events: EventsMap = {
    "answer": {
        name: "answer",
        parameters: {
            message:
        },
        validator: (param: object) => { return true && Boolean(param) }
    },

    "accepted": {
        name: "accepted",
        parameters: {  },
        validator: (param: object) => { return true && Boolean( param ) }
    },

    "leaved": {
        name: "leaved",
        parameters: {},
        validator: (param: object) => { return true && Boolean(param) }
    },

    "created": {
        name: "created",
        parameters: {  },
        validator: (param: object) => { return true && Boolean( param ) }
    },

    "restored": {
        name: "answer",
        parameters: {},
        validator: (param: object) => { return true && Boolean(param) }
    },

    "closed": {
        name: "accepted",
        parameters: {  },
        validator: (param: object) => { return true && Boolean( param ) }
    },

    "onlineCount": {
        name: "onlineCount",
        parameters: {},
        validator: (param: object) => { return true && Boolean(param) }
    },
}

class Reactor extends EventEmitter {
    protected url: string;
    protected socket: WebSocket;

    private managerConnected: boolean = false;

    public errorHandler: (err) => void = () => {};

    constructor() {
        super();
        this.url = "wss://f7cb-185-253-102-98.ngrok.io/ws?hash="+getCookie("chatHash");
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
        }

        this.socket.onmessage = (ev: MessageEvent<string>) => {
            let json = JSON.parse(ev.data.toString());
            let data = json;
            console.log(data);
            switch (data.event) {
                case "created":
                    setCookie("chatHash", data.payload.hash);
                    break;
                case "restored":
                    console.log("restored TODO");
                    break;
                case 'answer':
                    this.emit("answer", data.payload.message);
                    break;
                case "accepted":
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

    sendMessage(msg: ClientChatMessage) {
        let req = {
            target: "message",
            payload: {
                message: msg
            }
        }
        this.socket.send(JSON.stringify(req));
    }
}

class Controller {
    private whileSending: boolean = false;
    private chat: Chat;
    private bot: Bot;

    private readonly userIconPath = "/rediirector/images/avatars/user-icon.png";
    private readonly botIconPath = "/rediirector/images/avatars/bot-icon.png";
    private readonly notifySound = new Audio("/rediirector/sounds/chat-notify.mp3");

    constructor() {
        this.chat = new Chat();
        this.bot = new Bot();

        $('#chat-input').bind('keyup', (event) => { if (event.keyCode == 13) this.handleUserInput(event); });
        $("#chat-submit").on("click", this.handleUserInput);

        if (getCookie("saveChatSession") == "true") {
            $("#chat-save-session").addClass("chat-settings-active");
        } else {
            setCookie("saveChatSession", "false");
            $("#chat-save-session").addClass("chat-settings-diactive");
        }
    }

    handleUserInput(event) {
        let msg: string = <string>$('#chat-input').val();
        if (msg.length > 0) {
            this.chat.appendMessage({
                message: {
                    id: 0,
                    stamp: new Date().getDate(),
                    from: {
                        type: "customer",
                        name: getCookie("customerName"),
                    },
                    text: msg,
                    attachments: []
                }});
            $("#chat-input").val('');
        }
    }
}

window.onload = () => { new Controller() };

// delete chat session if started
window.onunload = () => { }
