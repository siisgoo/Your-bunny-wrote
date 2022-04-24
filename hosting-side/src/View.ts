import { Chat, ChatToggle, ChatHeader } from './Components'
import { Model } from './Model'
import { DragDrop } from './DragAndDrop'

export class View {
    // private readonly userIconPath = "/rediirector/images/avatars/user-icon.png";
    // private readonly botIconPath = "/rediirector/images/avatars/bot-icon.png";
    private readonly notifySound = new Audio("/rediirector/sounds/chat-notify.mp3");

    private chat: Chat;
    private chatHeader: ChatHeader;
    private chatToggle: ChatToggle;

    constructor(private model: Model) {
        this.chat = new Chat();
        this.chatHeader = new ChatHeader(this.chat);
        this.chatToggle = new ChatToggle();

        new DragDrop(this.chat.box, this.chatHeader.el);
    }

    init() {
        this.chat.init();
    }

    update(cmd: string) {
        switch (cmd) {

        }
    }
}
