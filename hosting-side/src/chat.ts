import { ClientChatMessage, ChatMessage } from 'Schemas'

const VERSION = "v0.1.2 beta";
const botName = "Shady " + VERSION;

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

// interface botMessage {
//     text: string,
//     buttons?: ChatMessageButton[],
// }

// const botMessages: Record<string, botMessage> = {
//     startup:           { text: 'Я - ' + botName },
//     enterName:         { text: "Как к вам обращаться?" },
//     returnToManager:   { text: "Тут я бессилен, вызываю оператора." },
//     waitForManager:    { text: "Пожалуйста, подождите, вам скоро ответят." },
//     chatClosed:        { text: "Чат закрыт, надеюсь мы помогли вам." },
//     managerLeaved:     { text: "Менеджер вышел из чата, ищем вам другого." },
//     historyTurnDelete: { text: "Сообщения больше не будут сохраняться в историю" },
//     historyTurnSave:   { text: "Сообщения будут сохраняться в историю" },
//     internalError:     { text: "Ой-ой. Что то пошло не так, пожалуйста, презагрузите страницу." },
//     serviceNotAvalible:{ text: "Сервис временно не доступен." },
//     whatBotCan:        { text: "Я умею:</br>Вызывать оператора</br>...В разработке..." },

//     botCommands: {
//         text: "Чем буду полезен?",
//         buttons: [
//             { name: "Список возможностей", value: "_showWhatBotCan" },
//             { name: 'Вызвать оператора',   value: '_callManager'  }
//         ]
//     },
// }

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

class Controller {

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
