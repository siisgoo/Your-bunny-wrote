const baseUrl = document.location.origin;

const VERSION = "v0.1.2 beta";
const botName = "Tech-bot " + VERSION;

// TODO add drag lock

interface pollUpdateAnswer {
    status: string,
    info: string,
    newManagerName: string,
    msgs: Array<ChatMessage>,
    error?: string,
};

interface cookieOptions {
    Domain?: string,
    Path?: string,
    Expires?: string,
    Size?: number,
    HttpOnly?: boolean,
    Secure?: boolean,
    SameSite?: string
};

interface ChatButton {
    name: string,
    value: string,
};

interface ChatMessage {
    text: string,
    from: string,
    id?: number,
    time?: number,
    creator?: string,
    type?: string,
    managerId?: number,
    avatarPath?: string,
    buttons?: Array<ChatButton>
};

// danger global config
let lastMessageId: number = 0; // local message id, will not be synced with server
let chatHistory: Array<ChatMessage> = [];
let chatHash: string; // palce holder of cookie chatHash, only for prevent deletion before reload
let managerRequired: boolean = false; // trigger to connect manager or use bot
const updateManagersInterval: number = 10000;
let onWaitManager: boolean = false;
let pollUpdatesInterval: number = 1000;
let pollUpdatesTimer; //palce holder
let onEnteringName: boolean = false; // trigger to redirect next user message to them name
let whileSending: boolean = false;

let chatToggleStillHovered  = false;
let chatToggleAlreadyOpened = false;

const botMessages = {
    startup:           () => appendMessage({ from: "b", text: 'Я - tech-bot.'}),
    enterName:         () => appendMessage({ from: "b", text: "Как к вам обращаться?" }),
    returnToManager:   () => appendMessage({ from: "b", text: "Тут я бессилен, вызываю оператора." }),
    waitForManager:    () => appendMessage({ from: "b", text: "Пожалуйста, подождите, вам скоро ответят." }, false),
    chatClosed:        () => appendMessage({ from: "b", text: "Чат закрыт, надеюсь мы помогли вам." }),
    managerLeaved:     () => appendMessage({ from: "b", text: "Менеджер вышел из чата, ищем вам другого." }),
    historyTurnDelete: () => appendMessage({ from: "b", text: "Сообщения больше не будут сохраняться в историю" }, false),
    historyTurnSave:   () => appendMessage({ from: "b", text: "Сообщения будут сохраняться в историю" }, false),
    internalError:     () => appendMessage({ from: "b", text: "Ой-ой. Что то пошло не так, пожалуйста, презагрузите страницу." }),
    whatBotCan:        () => appendMessage({ text: "Я умею:</br>Вызывать оператора</br>...В разработке...", from: 'b', }),

    botCommands: () => appendMessage({
        text: "Чем буду полезен?",
        from: 'b',
        buttons: [
            { name: "Список возможностей", value: "_showWhatBotCan" },
            { name: 'Вызвать оператора',   value: '_callManager'  }
        ]
    }),
};

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

// return collibrated ChatMessage object
function appendMessage(message: ChatMessage, save = true): ChatMessage {
    switch (message.from) {
        case 'm': {
            if (message.creator == null) {
                message.creator = 'Менеджер';
            }
            message.avatarPath = '/techbot/images/avatars/' + message.managerId;
            message.type = "user";
            break;
        }
        case 'b': {
            message.creator = botName;
            message.avatarPath = "/techbot/images/avatars/bot-icon.png";
            message.type = "user";
            break;
        }
        case 'c': {
            if (getCookie("customerName")) {
                message.creator = getCookie("customerName");
            } else {
                message.creator = "Customer";
            }
            message.avatarPath = "/techbot/images/avatars/user-icon.png";
            message.type = "self";
            break;
        }
        default: {
            console.log("appendMessage: passed unknown msgFrom value - ", message.from);
            return; // TODO return error msg, handle err
        }
    }

    if (message.time == null) {
        message.time = new Date().getTime();
    }
    let time = new Date(message.time).toLocaleTimeString();

    lastMessageId++;
    message.id = lastMessageId;
    if (save === true) {
        chatHistory.push(message);
    }

    let str =
            "<div id='cm-msg-" + message.id + "' class=\"chat-msg " + message.from + " " + message.type + "\">" +
                "<span class=\"msg-avatar\">" +
                    "<img src=\"" + message.avatarPath + "\">" +
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
                        message.buttons.map(button =>
                        "<li class=\"button\">" +
                            "<span onclick=\"handleButtonClick(\'" + button.name + "\',\'" + button.value + "\', \'" + lastMessageId + "\')\" class=\"chat-button\"\">" +
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
    $("#cm-msg-"+lastMessageId).hide().fadeIn(300);

    // if (message.buttons) {
    //     $("#chat-logs").stop().animate({ scrollTop: $("#chat-logs")[0].scrollHeight }, 1000);
    // } else {
        $("#chat-logs").stop().animate({ scrollTop: $("#chat-logs")[0].scrollHeight }, 1000);
    // }

    return message;
}

function saveChatHistory(): void { localStorage.setItem("chatHistory", JSON.stringify(chatHistory)); }

// maybe use indexedDb instead?
function loadChatHistory(): void {
    let messages: string = localStorage.getItem("chatHistory");
    if (messages) {
        chatHistory = JSON.parse(messages);
        if (chatHistory.length > 0) {
            chatHistory.forEach(m => appendMessage(m, false));

            if (getCookie("managerName")) {
                let l_chatHash: string = getCookie("chatHash");
                if (l_chatHash) {
                    chatHash = l_chatHash;
                    $("#chat-manager-name").text(getCookie("managerName"));
                    managerRequired = true;
                    onWaitManager = false;
                    startPolling(pollUpdatesInterval);
                } else {
                    returnToBot();
                }
            }
        } else {
            returnToBot();
        }
    } else {
        returnToBot();
    }
}

function resetChat(): void {
    disconnectFromManager();
    localStorage.removeItem("chatHistory");
    lastMessageId = 0;
    chatHistory = [];
    deleteCookie("chatHash");
    chatHash = null;
    deleteCookie("customerName");
    deleteCookie("managerName");
    $(".chat-msg").each(function(i, itm) { // TODO add animation
        $(this).remove();
    });
    returnToBot();
}

function getCookie(name: string) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

function setCookie(name: string, value: string, options: cookieOptions = {}) {
    options = {
        Path: '/',
        Secure: true,
        SameSite: "none"
    };

    let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);
    for (let optionKey in options) {
        updatedCookie += "; " + optionKey;
        let optionValue = options[optionKey];
        if (optionValue !== true) {
            updatedCookie += "=" + optionValue;
        }
    }
    document.cookie = updatedCookie;
}

function deleteCookie(name) { setCookie(name, "", { Expires: new Date(-1).toUTCString() }); }

function startPolling(interval) {
    pollUpdatesTimer = setInterval(function() {
        pollUpdates();
    }, pollUpdatesInterval);
}

function stopPolling() {
    clearInterval(pollUpdatesTimer);
}

function updateManagersCount() {
    // dont handle fail, obviusly it will be 0
    $.ajax({
        url: baseUrl + '/techbot/service/actions/getOnline.php',
        type: 'GET',
        async: true,
        timeout: updateManagersInterval - 10
    })
        .done((count) => {
            $("#chat-managers-online-num").text(count);
            if (!chatToggleAlreadyOpened) {
                adjustChatToggle();
            }
        });
}

function pollUpdates() {
    let params = {
        chatHash: chatHash
    };

    $.ajax({
        url: baseUrl + '/techbot/service/actions/pollUpdates.php',
        type: 'GET',
        dataType: 'JSON',
        data: params,
        async: true,
        timeout: pollUpdatesInterval
    }).done(function(answer: pollUpdateAnswer) {
        switch (answer.status) {
            case 'ok':
                switch (answer.info) {
                    case 'closed':
                        deleteCookie("managerName");
                        botMessages.chatClosed();
                        returnToBot(false);
                        const audio = new Audio("/techbot/new_message_sound.mp3");
                        audio.play();
                        break;
                    case 'pending':
                        if (!onWaitManager) {
                            deleteCookie("managerName");
                            botMessages.managerLeaved();
                            returnToBot(false);
                            returnToManager();
                            const audio = new Audio("/techbot/new_message_sound.mp3");
                            audio.play();
                        }
                        break;
                    case 'inchat':
                        if (onWaitManager) {
                            setCookie("managerName", answer.newManagerName);
                            $("#chat-manager-name").text(answer.newManagerName);
                            onWaitManager = false;
                            const audio = new Audio("/techbot/new_message_sound.mp3");
                            audio.play();
                        }
                        break;
                    default:
                        console.log("Unknown result by tbGetMessages.php: ", answer);
                        // allert
                        return;
                }

                // print messages
                if (answer.msgs) {
                    if (answer.msgs.length > 0) {
                        $.each(answer.msgs, function(i, _msg) {
                            if (_msg.from == 'm') { // TODO somewhere BAG
                                appendMessage(_msg);
                            }
                        });

                        const audio = new Audio("/techbot/new_message_sound.mp3");
                        audio.play();
                    }
                }

                return true;
                break;
            case 'error':
                console.log(answer);
                console.log('FAIL ' + answer.status);
                console.log('INFO ' + answer.info);
                if (answer.error == 'bad_chHash') {
                    chatHash = null;
                    deleteCookie('chatHash');
                    setTimeout(pollUpdates, 1000);
                }
                break;
            default:
                alert("Что то сломалось, перезагрузите страницу");
                break;
        }
    })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.log('FAIL ' + textStatus);
            console.log(jqXHR)
        });
}

function sendMessage(message: ChatMessage) {
    whileSending = true;

    // TODO replace </br> with \n

    const request = {
        message:  message,
        chatHash: chatHash,
    };

    $.ajax({
        url: baseUrl + '/techbot/service/actions/sendMessage.php',
        type: 'POST',
        dataType: 'JSON',
        data: request,
        async: true,
        timeout: 25000
    })
        .done(function(answer) {
            whileSending = false;
            if (answer.status == 'ok') {
            } else if (answer.status == 'error') {
                console.log("Error while sending message: ", answer);
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            whileSending = false;
            console.log("failed");
            console.log(jqXHR);
            console.log(textStatus);
        });
}

function disconnectFromManager() {
    if (managerRequired) {
        let params = {
            chatHash: chatHash
        };
        $.ajax({
            url: baseUrl + '/techbot/service/actions/closeSession.php',
            type: 'POST',
            dataType: 'JSON',
            data: params,
            async: false
        }).fail((f) => console.log(f));
    }
}

function returnToManager() {
    managerRequired = true;
    onWaitManager = true;

    let params = {
        chatHash: getCookie('chatHash')
    };

    $.ajax({
        url: baseUrl + '/techbot/service/actions/requestManager.php',
        type: 'POST',
        dataType: 'JSON',
        data: params,
        async: true,
        timeout: 60 * 1000,
    })
        .done(res => {
            chatHash = res.chatHash;
            setCookie('chatHash', res.chatHash, {Secure: true});

            chatHistory.forEach(msg => {
                sendMessage(msg);
            });

            startPolling(pollUpdatesInterval);
        })
        .fail((jqXHR, textStatus, errorThrown) => {
            console.log('FAIL ' + textStatus);
            console.log(jqXHR);
            botMessages.internalError();
        });
}

function returnToBot(showStartMsg = true) {
    if (showStartMsg) {
        botMessages.startup();
    }
    stopPolling();
    $("#chat-manager-name").text(botName);
    managerRequired = false;
    onWaitManager = false;
    whileSending = false;

    // TODO customer name add prompt to set its
    if (!getCookie('customerName')) {
        botMessages.enterName();
        onEnteringName = true;
    } else {
        botMessages.botCommands();
    }
}

// TODO
let smartcmp = (src, dst) => src == dst;

// TODO
function faqSearch(str) {
    // load faq array from server to cache or restore
    // then cmp to str
    return null;
}

function handleButtonClick(name, value, messageId) {
    $("#cm-msg-" + messageId +" .cm-msg-button").remove();
    appendMessage({ text: name, from: 'c' });

    switch (value) {
        case "_callManager":
            // TODO add msg
            appendMessage({text: "Вызываю оператора", from: 'b'});
            returnToManager();
            break;
        case "_showWhatBotCan":
            botMessages.whatBotCan();
            break;
    }

    // TODO remove buttons from chatHistory
}

function handleUserInput(event) {
    let msg: string = <string>$('#chat-input').val();
    if (msg.length > 0) {
        // use queue?
        if (whileSending != true) {
            let messageObj = appendMessage({ from: 'c', text: msg });
            $("#chat-input").val('');
            if (managerRequired) // manager
            {
                if (onWaitManager) {
                    botMessages.waitForManager();
                }
                sendMessage(messageObj);
            }
            else // bot
            {
                if (onEnteringName) { // setup client name
                    setCookie('customerName', msg);
                    onEnteringName = false;
                    botMessages.botCommands();
                } else { // answer
                    let faqAns = faqSearch(msg);
                    if (faqAns != null) {
                        appendMessage(faqAns);
                    } else {
                        botMessages.returnToManager();
                        returnToManager();
                    }
                }
            } // end bot
        } // end if whileSending
    } // end if msg.length > 0
}

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

        this.item['onPositionChanged'](this.updateOffset.bind(this));

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

function chatToggleNormalLeft(): number {
    return $("#chat-toggle-text").width() - $("#chat-toggle").width() + 4;
}

function adjustChatToggle(time = 0): void {
    $("#chat-toggle").animate({left: chatToggleNormalLeft()}, time);
}

function setTranslate(xPos, yPos, el, time = 0): void { el.animate({ left: xPos, top: yPos }, time); }

function setupChatMovement(): void {
    // TODO best nameing, ever...
    const frame_initial = $("#chat-box").position();

    const frame_normal_x = $("#chat-box").position().left;
    const frame_hide_x = -$("#chat-box").width() - frame_normal_x;

    const frame_normal_height = $("#chat-box").height();

    let chatFrameState =
        {'hidden': false, 'visible': true};

    let chatResizeLock = false;

    $("#chat-toggle").hover(
        e => {
            let animate = () => $("#chat-toggle").stop().animate({ left: 0 }, 1500, "easeInOutQuint"); // TODO adjust duration by showed width
            chatToggleStillHovered = true;
            if (chatToggleAlreadyOpened) {
                chatToggleAlreadyOpened = true;
                animate();
            } else {
                setTimeout(() => {
                    if (chatToggleStillHovered) {
                        chatToggleAlreadyOpened = true
                        animate();
                    }
                }, 1050)
            }
        }, e => {
            chatToggleStillHovered = false;
            $("#chat-toggle").stop().animate({ left: chatToggleNormalLeft() }, 2000, "easeOutCubic", () => { chatToggleAlreadyOpened = false; });
        }
    );

    $("#chat-toggle-text").on("click", ev => {
        if (chatFrameState.hidden) {
            chatFrameState.hidden = false;
            chatFrameState.visible = true;
            $("#chat-box").stop();
            $("#chat-box")
                .animate({
                    left: frame_normal_x,
                    top: frame_initial.top,
                    height: "toggle",
                    width: "toggle"
                }, 1000, "easeOutQuad");
        } else {
            chatFrameState.hidden = true;
            chatFrameState.visible = false;
            $("#chat-box").stop();
            $("#chat-box")
                .animate({
                    left: frame_hide_x,
                    top: frame_initial.top,
                    height: "toggle",
                    width: "toggle"
                }, 1000, "easeOutQuad");
        }
    });

    function resizeChat(size: { width: number, height: number }, dur: number = 0, then = null) {
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

    // reset to default
    resizeChat({ width: $("#chat-box").width(), height: $("#chat-box").height() });
    $("#chat-vertical-normal").css("display", "none");

    // chat resizing buttons
    $("#chat-vertical-maximize").on("click", function() {
        if (!chatResizeLock) {
            chatResizeLock = true;
            $(this).css("display", "none");
            $("#chat-vertical-normal").css("display", "block");

            $("#chat-box").animate(
                {
                    top: 0,
                    left: 6
                }, 500,
                () => {
                    resizeChat(
                        {
                            width: $("#chat-box").width(),
                            height: window.innerHeight
                        }, 1000,
                        () => {
                            chatResizeLock = false;
                        });
                }
            );
        }
    });
    $("#chat-vertical-normal").on("click", function()  {
        if (!chatResizeLock) {
            chatResizeLock = true;
            $("#chat-vertical-maximize").css("display", "block");
            $(this).css("display", "none");

            resizeChat(
                {
                    width: $("#chat-box").width(),
                    height: frame_normal_height
                }, 1000,
                () => $("#chat-box").animate(
                    {
                        top: frame_initial.top,
                        left: frame_initial.left
                    }, 500,
                    () => {
                        chatResizeLock = false;
                    })
            );
        }
    });
}

function setup(): void {
    new DragDrop($("#chat-box"), $("#chat-box-header"));
    // send buttons
    $('#chat-input').bind('keyup', (event) => { if (event.keyCode == 13) handleUserInput(event); });
    // $("#chat-submit").on("click", handleUserInput);
    $("#chat-submit").on("click", () => {
        let ws = new WebSocket("ws://38f1-185-253-102-98.ngrok.io/ws");
        ws.onopen = (e) => {
            ws.send("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        }
    });

    // setting chat background
    let bg = getCookie('chatBackground');
    if (bg) {
        $("#chat-box-body").css("background-image", bg);
    } else {
        let rand = (min, max) => Math.round(Math.random() * (max - min) + min);
        $("#chat-box-body")
            .css("background-image",
                 "url(/techbot/images/backgrounds/chat-background-"+rand(1, $("#chat-background-count").attr("data"))+".png)");
    }

    // setup control panel
    if (getCookie("saveChatSession") == "true") {
        $("#chat-save-session").addClass("chat-settings-active");
        loadChatHistory();
    } else {
        setCookie("saveChatSession", "false");
        $("#chat-save-session").addClass("chat-settings-diactive");
        returnToBot();
    }

    $("#chat-save-session").on("click", () => {
        // TODO move to functions
        if (getCookie("saveChatSession") == "true") {
            setCookie("saveChatSession", "false");
            $("#chat-save-session").removeClass("chat-settings-active");
            $("#chat-save-session").addClass("chat-settings-diactive");
            botMessages.historyTurnDelete();
        } else {
            setCookie("saveChatSession", "true");
            $("#chat-save-session").removeClass("chat-settings-diactive");
            $("#chat-save-session").addClass("chat-settings-active");
            botMessages.historyTurnSave();
        }
    });

    $("#chat-reset").on("click", () => resetChat());

    $("#chat-box").animate({opacity: 1}, 1000);
    $("#chat-toggle").css("left", -$("#chat-toggle").width());
    adjustChatToggle(1000);

    // TODO use event-based model
    // bot online listner
    updateManagersCount();
    setInterval(updateManagersCount, updateManagersInterval)

    // chat drag and effects
    setupChatMovement();

//     setTimeout(() => {
//         const evtSource = new EventSource("update.php");
//         console.log(evtSource.withCredentials);
//         console.log(evtSource.readyState);
//         console.log(evtSource.url);

//         evtSource.onopen = function() {
//             console.log("Connection to server opened.");
//         };

//         evtSource.onmessage = (event: any) => {
//             var jdata = JSON.parse(event.data);
//             console.log(jdata);
//         };
//         evtSource.addEventListener('error', (err) => {
//             console.error("EventSource failed:", err);
//         });
//     }, 2000);
}

window.onload = async () => setup();

// delete chat session if started
window.onunload = () => {
    if (getCookie("saveChatSession") == "false") {
        resetChat();
    } else {
        saveChatHistory();
    }
}
