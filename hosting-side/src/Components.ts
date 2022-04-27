import { ChatMessage } from "Schemas/ChatMessage.js"
import { ManagerSchema } from "Schemas/Manager.js"

// function sleep(ms: number) {
//     return new Promise((resolve) => {
//         setTimeout(resolve, ms);
//     });
// }

export class ChatHeader {
    public readonly el: JQuery<HTMLElement> = $("#chat-box-header");

    constructor(chat: Chat) {
        // reset to default
        $("#chat-vertical-normal").css("display", "none");

        // chat resizing buttons
        $("#chat-vertical-maximize").on("click", () => {
            chat.maximizeVerticaly();
        });
        $("#chat-vertical-normal").on("click", () => {
            chat.toNormal();
        });
    }

    init() {
    }

    // public setTitle(text: string) {
    //     this.el.children("")
    // }

    public async setSubTitle(text: string) {
        $("#chat-manager-name").text(text);
    }
}

export class Chat {
    // private last_message_id: number = -1; // local message id, will not be synced with server

    private resizeLock: boolean = false;
    private hidden: boolean = false;
    readonly initialPosition: JQuery.Coordinates;
    readonly initialSize: { height: number, width: number };

    public readonly box: JQuery<HTMLElement> = $("#chat-box");
    public readonly body: JQuery<HTMLElement> = $("#chat-box-body");
    public readonly inputField: JQuery<HTMLElement> = $("#chat-input");

    private readonly notifySound = new Audio("/rediirector/sounds/chat-notify.mp3");

    constructor() {
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
            $("#chat-logs").append("<div class=\"loader\"></div>")
        }
    }

    public unsetSpiner() {
        // $("#chat-logs").children(".loader").fadeOut(400, function() { this.remove() });
        $("#chat-logs").children(".loader").remove();
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
                            width: $("#chat-box").width() ?? 300,
                            height: window.innerHeight
                        }, 1000,
                        () => {
                            this.resizeLock = false;
                            then;
                        }
                    );
                }
            );
        }
    }

    public toNormal() {
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

    public appendMessage(message: ChatMessage, manager?: ManagerSchema) {
        // if (message.id < 0) message.id = this.last_message_id+1;
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
                if (manager) {
                    avatar_url = "/rediirector/images/avatars/bot-icon.png"; // TODO
                } else {
                    avatar_url = "/rediirector/images/avatars/bot-icon.png";
                }
                // TODO icon load
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

        let str =
                "<div id='cm-msg-" + message.id + "' class=\"chat-msg " + type + "\">" +
                    "<span class=\"msg-avatar\">" +
                        "<img src=\"" + avatar_url + "\">" +
                    "<\/span>" +
                    "<div class=\"cm-msg-text\">" +
                        message.text +
                        "<div class=\"cm-msg-time\">" +
                            time +
                        "<\/div>" +
                    "<\/div>";

        if (message.buttons) {
            // btn-primary chat-btn
            str +=  "<div class=\"cm-msg-button\">" +
                        "<ul>" +
                            message.buttons.map((button: {name: string, value: string}) =>
                            "<li class=\"button\">" +
                                "<span onclick=\"handleButtonClick(\'" + button.name + "\',\'" + button.value + "\', \'" + message.id + "\')\" class=\"chat-button\"\">" +
                                    button.name +
                                "<\/span>" +
                            "<\/li>"
                        ).join('') +
                        "<\/ul>" +
                    "<\/div>";
        }
        str +=
                "<\/div>";

        $("#chat-logs").append()

        $('#chat-logs').append(str);
        $("#cm-msg-"+message.id).hide().fadeIn(300);
        $("#chat-logs").stop().animate({ scrollTop: $("#chat-logs")[0].scrollHeight }, 0);
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
    public readonly toggleTirggerEl: JQuery<HTMLElement> = this.el.children("#chat-toggle-text")

    public onTriggered: () => void = () => {}

    constructor() {
        this.toggleTirggerEl.on("click", this.onTriggered);
    }

    init() {
        this.el.hover(
            () => this.show(),
            () => this.hide()
        );

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
