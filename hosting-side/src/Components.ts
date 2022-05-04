import { ChatMessage } from "Schemas/ChatMessage.js"
import { Model } from './Model.js'
// import WebLoader from './loader.js'

export class ChatHeader {
    public readonly el: JQuery<HTMLElement> = $("#chat-box-header");

    constructor(chat: Chat) {
        // reset to default
        $("#chat-vertical-normal").css("display", "none");

        // chat resizing buttons
        $("#chat-vertical-maximize").on("click", () => {
            $("#chat-vertical-maximize").css("display", "none");
            $("#chat-vertical-normal").css("display", "block");
            chat.maximizeVerticaly();
        });
        $("#chat-vertical-normal").on("click", () => {
            $("#chat-vertical-maximize").css("display", "block");
            $("#chat-vertical-normal").css("display", "none");
            chat.toNormal();
        });
    }

    init() {
    }

    // public setTitle(text: string) {
    //     this.el.children("")
    // }

    public setSubTitle(text: string) {
        $("#chat-manager-name").text(text);
    }
}

export class Chat {
    // private last_message_id: number = -1; // local message id, will not be synced with server

    private resizeLock: boolean = false;
    private hidden: boolean = false;
    // private loader: WebLoader;
    readonly initialPosition: JQuery.Coordinates;
    readonly initialSize: { height: number, width: number };

    public readonly box: JQuery<HTMLElement> = $("#chat-box");
    public readonly body: JQuery<HTMLElement> = $("#chat-box-body");
    public readonly inputField: JQuery<HTMLElement> = $("#chat-input");

    private readonly notifySound = new Audio("/rediirector/sounds/chat-notify.mp3");

    constructor(private model: Model) {
        // this.loader = new WebLoader();
        this.initialPosition = $("#chat-box").position();
        this.initialSize = {
            height: <number>$("#chat-box").innerHeight(),
            width: <number>$("#chat-box").innerWidth()
        };

        this.resizeChat({ width: this.initialSize.width, height: this.initialSize.height });
    }

    deconstructor() {
    }

    public init() {
        // show chat
        this.box.animate({opacity: 1}, 1000);
    }

    public setSpiner() {
        if (!$("#chat-logs").find(".loader").length) {
            $("#chat-logs .chat-msg").each(function() { $(this).hide() })
            $("#chat-logs").append('<span class="loader"></span>');
            // $("#chat-logs").append("<canvas class=\"web-loader\" style=\"height: 200px; width: 200px;\"></canvas>");
            // $("#chat-logs .web-loader").width($("#chat-logs").width() ?? 100).height($("#chat-logs").height() ?? 100);
            // this.loader.start(<HTMLCanvasElement>$("#chat-logs .web-loader")[0]);
        }
    }

    public unsetSpiner() {
        // this.loader.stop();
        // $("#chat-logs").children(".loader").fadeOut(0, function() { this.remove() });
        $("#chat-logs .loader").each(function() { $(this).remove() })
        $("#chat-logs").children("chat-msg").each(function() { $(this).show() })
    }

    public setManagerEvent(text?: string) {
        if (text) {
            $("#chat-logs #chat-manager-state").text(text);
        } else {
            $("#chat-logs #chat-manager-state").text("");
        }
    }

    public hide() {
        this.hidden = true;
        return $("#chat-box")
            .stop()
            .animate({
                left: -(this.box.width() ?? 0) - this.initialPosition.left,
                top: this.initialPosition.top,
                height: "toggle",
                width: "toggle"
            }, 1000, "easeOutQuad");
    }

    public show() {
        this.hidden = false;
        return this.box
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

    public setInput(str: string, append: boolean = true) {
        let oldInput: string = this.inputField.val()!.toString();
        if (!append) {
            oldInput = '';
        } else if (oldInput !== '') {
            oldInput += ' ';
        }
        this.inputField.val(oldInput + str);
        this.inputField.on('blur', function() {
            $(this).off('blur');
            setTimeout(() => {
                this.focus();
            }, 10);
        }).blur();
    }

    public playNotify(/*type?: NotifyType*/) {
        this.notifySound.play();
    }

    public setBackground(src: string) {
        this.body.css("background-image", src);
    }

    public resizeChat(size: { width: number, height: number }, dur: number = 0, then?: () => void) {
        $("#chat-logs").animate({
            height: size.height -
                    $("#chat-box-header")[0].offsetHeight -
                    $("#chat-input")[0].offsetHeight
        }, dur, then);
        this.box.animate({
            width: size.width,
            height: size.height
        }, dur, then);
    }

    public maximizeVerticaly(then?: () => void) {
        if (!this.resizeLock) {
            this.resizeLock = true;

            $("#chat-box").animate(
                {
                    top: 0,
                    left: 6
                }, 500,
                () => {
                    this.resizeChat(
                        {
                            width: $("#chat-box").width() ?? 300,
                            height: window.innerHeight
                        }, 1000,
                        () => {
                            this.resizeLock = false;
                            then;
                        }
                    )
                }
            )
        }
    }

    public toNormal() {
        if (!this.resizeLock) {
            this.resizeLock = true;

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
    }

    // public handleButtonClick(name: string, value: string, messageId: number) {
    //     $("#cm-msg-" + messageId +" .cm-msg-button").remove();
    //     this.appendMessage(
    //         { text: name, from: 'customer', id: -1, time: new Date().getTime(), creator: "Customer");

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

    makeUrl(message: string, span: JQuery<HTMLElement>) {
        let url;
        let urlHttp = message.indexOf('http://');

        if (urlHttp < 0) {
            let urlHttps = message.indexOf('https://');
            if (urlHttps < 0) {
                url = -1;
            } else {
                url = urlHttps;
            }
        } else {
            url = urlHttp;
        }

        if (url > -1) {
            let startUrl = message.substr(url);
            let endSpace = startUrl.indexOf(' ');
            let endUrl = (endSpace > -1 ? endSpace : message.length);
            let allUrl = message.substr(url, endUrl);
            let urlText = '<a href="' + allUrl + '" target="_blank">' + allUrl + '</a>';
            span.html(span.html().replace(allUrl, urlText));

            if (endUrl > -1 &&
                (message.indexOf('http://', endUrl) > -1 || message.indexOf('https://', endUrl) > -1)) {
                span = this.makeUrl(message.substr(endUrl+1), span);
            }
        }

        return span;
    }

    public appendMessage(message: ChatMessage) {
        // if (message.id <= this.last_message_id) return;
        // this.last_message_id = message.id;

        let type: string = "";
        let avatar_url: string = String(); // TODO read from model
        switch (message.from.type) {
            case "bot":
                avatar_url = "/rediirector/images/avatars/bot-icon.png";
                type = "user";
            break;
            case "manager":
                type = "user";
                avatar_url = "/rediirector/images/avatars/user-icon.png";
                if (message.from.userid > 0) {
                    let file = this.model.getFile(message.from.userid.toString());
                    if (file) {
                        avatar_url = "data:image/png;base64," + file.data.toString();
                    } else {
                        avatar_url = "/rediirector/images/avatars/user-icon.png";
                    }
                }
                break;
            case "customer":
                type = "self";
                avatar_url = "/rediirector/images/avatars/user-icon.png"
                break;
            default:
                console.log("appendMessage: passed unknown msgFrom value - ", message.from);
                return; // TODO return error msg, handle err
        }
        let time = new Date(message.stamp).toLocaleTimeString();

        let container = $('<div></div>').appendTo( $('#chat-logs') ).attr("id", message.id).addClass("chat-msg").addClass(type);
        let avatar_container = $('<span></span>').addClass("msg-avatar").appendTo(container);
        $('<img></img>').attr("src", avatar_url).appendTo(avatar_container);

        let content = $('<div></div>').addClass("cm-msg-text").html(message.text);
        content = this.makeUrl(message.text, content);
        content.appendTo(container);
        $('<div></div>').addClass("cm-msg-time").text(time).appendTo(content);

        if (message.buttons) {
            let buttons_container = $('<div></div>').addClass("cm-msg-button");
            let buttons_list = $('<ul></ul>').appendTo(buttons_container);
            message.buttons.map( (button: typeof message.buttons[0] ) => {
                // btn-primary chat-btn
                let wrapper = $('<li></li>').addClass("button");
                $('<span></span>').addClass("chat-button").text(button.name).appendTo(wrapper);
                wrapper.appendTo(buttons_list);
            })
        }

        $("#cm-msg-"+message.id).hide().fadeIn(300);
        $("#chat-logs").stop().animate({ scrollTop: $("#chat-logs")[0].scrollHeight }, 700);
    }

    public clear(): void {
        // this.last_message_id = 0;
        $(".chat-msg").each(function() {
            $(this).fadeOut(300, function() { this.remove() });
        });
    }
}

export class ChatToggle {
    public stillHovered = false;
    public opened = false;
    public readonly el: JQuery<HTMLElement> = $("#chat-toggle");

    public onTriggered: () => void = () => {}

    constructor() {
        this.el.hover(
            () => this.show(),
            () => this.hide()
        );

        $("#chat-toggle-text").on("click", () => this.onTriggered());
    }

    init() {
        // @ts-ignore
        this.el.css("left", -this.el.width());
        this.adjust(1000);
    }

    show() {
        let f = () => this.el.stop().animate({ left: 0 }, 1500, "easeInOutQuint"); // TODO adjust duration by showed width
        this.stillHovered = true;
        if (this.opened) {
            f();
        } else {
            setTimeout(() => {
                if (this.stillHovered) {
                    this.opened = true
                    f();
                }
            }, 1050)
        }
    }

    hide() {
        this.stillHovered = false;
        this.el.stop().animate({ left: this.normalLeft }, 2000, "easeOutCubic", () => { this.opened = false; });
    }

    get normalLeft(): number {
        return ( this.el.children("#chat-toggle-text").width() ?? 0 ) -
               ( this.el.width() ?? 0 ) + 4;
    }

    adjust(time = 0): void {
        this.el.animate({left: this.normalLeft}, time);
    }
}
