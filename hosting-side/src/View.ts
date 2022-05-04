// import { isMobile } from './Utils.js'
import { Chat, ChatToggle, ChatHeader } from './Components.js'
import { ChatMessage } from 'Schemas/ChatMessage.js'
import { Model } from './Model.js'
import { DragDrop } from './DragAndDrop.js'
import { Controller } from './Controller.js'
import { EventEmitter } from './EventEmitter.js'

type v_em = {
    init: never;
    resetChat: never;
    newMessage: ChatMessage;
    toggleRememberMe: never;
}

export class View extends EventEmitter<v_em> {

    private controller?: Controller;

    private chat: Chat;
    private chatHeader: ChatHeader;
    private chatToggle: ChatToggle;

    // private isMobile: boolean = false;

    constructor(private model: Model) {
        super();
        this.chat = new Chat(model);
        this.chatHeader = new ChatHeader(this.chat);
        this.chatToggle = new ChatToggle();

        this.model.on("newMessage", (msg) => {
            this.chat.appendMessage(msg)
        })
        this.model.on("setStatus", (text) => {
            this.chatHeader.setSubTitle(text);
        })
        this.model.on("setLoading", () => {
            this.chat.setSpiner();
        })
        this.model.on("unsetLoading", () => {
            this.chat.unsetSpiner();
        })
        this.model.on("clear", () => {
            this.chat.clear();
        })

        // this.isMobile = isMobile();

        this.chatToggle.onTriggered = () => this.chat.toggle();

        $("#chat-reset").on("click", () => {
            this.chat.clear();
            this.notify("resetChat");
        });

        $('#chat-submit').on('click', () => {
            if (!this.model.isConnected())
                return;
            let curInput = $('#chat-input').val()!.toString();
            if (curInput.length) {
                let text: string = curInput;
                this.chat.inputField.val('').focus();
                if (text.trim() !== ''){
                    let id;
                    let lastMsg = this.model.getLastMessage();
                    if (lastMsg) id = lastMsg.id + 1;
                    else id = 0;

                    let msg: ChatMessage = {
                        id: id,
                        stamp: new Date().getTime(),
                        from: {
                            name: model.userName(),
                            type: "customer",
                            userid: 0
                        },
                        text: text
                    }
                    this.chat.appendMessage(msg);
                    this.notify('newMessage', msg);
                }
            }
        });

        $('#chat-input').on('keydown', (e) => {
            if (e.keyCode == 13) {
                $('#chat-submit').click();
            }
            // else if(e.keyCode == 38){
            //     this.notify('lastMessageInput');
            // }
            // else if(e.keyCode == 9){
            //     this.notify('autoComplete', $('#chat-input').val());
            // }
        }).focus();
    }

    init() {
        new DragDrop(this.chat.box, this.chatHeader.el);

        // Chat settings component
        $("#chat-save-session").on("click", () => {
            if (this.model.settings().rememberMe) {
                $("#chat-save-session")
                    .removeClass("chat-settings-active")
                    .addClass("chat-settings-diactive");
            } else {
                $("#chat-save-session")
                    .removeClass("chat-settings-diactive")
                    .addClass("chat-settings-active");
            }
            this.emit("toggleRememberMe");
        });
        $("#chat-save-session").click().click(); // TODO load

        this.chat.init();
        this.chatToggle.init();
        this.chatHeader.init();

        this.notify('init');
    }

    setController(controller: Controller) {
        this.controller = controller;
    }

    notify(cmd: string, args?: any) {
        this.controller?.receive(cmd, args);
    }
}
