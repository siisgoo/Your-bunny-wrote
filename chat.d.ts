/// <reference types="jquery" />
declare const baseUrl: string;
declare const VERSION = "v0.1.2 beta";
declare const botName: string;
interface pollUpdateAnswer {
    status: string;
    info: string;
    newManagerName: string;
    msgs: Array<ChatMessage>;
    error?: string;
}
interface cookieOptions {
    Domain?: string;
    Path?: string;
    Expires?: string;
    Size?: number;
    HttpOnly?: boolean;
    Secure?: boolean;
    SameSite?: string;
}
interface ChatButton {
    name: string;
    value: string;
}
interface ChatMessage {
    text: string;
    from: string;
    id?: number;
    time?: number;
    creator?: string;
    type?: string;
    managerId?: number;
    avatarPath?: string;
    buttons?: Array<ChatButton>;
}
declare let lastMessageId: number;
declare let chatHistory: Array<ChatMessage>;
declare let chatHash: string;
declare let managerRequired: boolean;
declare const updateManagersInterval: number;
declare let onWaitManager: boolean;
declare let pollUpdatesInterval: number;
declare let pollUpdatesTimer: any;
declare let onEnteringName: boolean;
declare let whileSending: boolean;
declare let chatToggleStillHovered: boolean;
declare let chatToggleAlreadyOpened: boolean;
declare const botMessages: {
    startup: () => ChatMessage;
    enterName: () => ChatMessage;
    returnToManager: () => ChatMessage;
    waitForManager: () => ChatMessage;
    chatClosed: () => ChatMessage;
    managerLeaved: () => ChatMessage;
    historyTurnDelete: () => ChatMessage;
    historyTurnSave: () => ChatMessage;
    internalError: () => ChatMessage;
    whatBotCan: () => ChatMessage;
    botCommands: () => ChatMessage;
};
declare function appendMessage(message: ChatMessage, save?: boolean): ChatMessage;
declare function saveChatHistory(): void;
declare function loadChatHistory(): void;
declare function resetChat(): void;
declare function getCookie(name: string): string;
declare function setCookie(name: string, value: string, options?: cookieOptions): void;
declare function deleteCookie(name: any): void;
declare function startPolling(interval: any): void;
declare function stopPolling(): void;
declare function updateManagersCount(): void;
declare function pollUpdates(): void;
declare function sendMessage(message: ChatMessage): void;
declare function disconnectFromManager(): void;
declare function returnToManager(): void;
declare function returnToBot(showStartMsg?: boolean): void;
declare let smartcmp: (src: any, dst: any) => boolean;
declare function faqSearch(str: any): any;
declare function handleButtonClick(name: any, value: any, messageId: any): void;
declare function handleUserInput(event: any): void;
declare class DragDrop {
    private Active;
    private CurrentX;
    private CurrentY;
    private InitialX;
    private InitialY;
    private OffsetX;
    private OffsetY;
    private item;
    private target;
    private container;
    constructor(item: JQuery<HTMLElement>, target: JQuery<HTMLElement>, container?: JQuery<HTMLElement>);
    private dragStart;
    private dragEnd;
    private updateOffset;
    private drag;
}
declare function chatToggleNormalLeft(): number;
declare function adjustChatToggle(time?: number): void;
declare function setTranslate(xPos: any, yPos: any, el: any, time?: number): void;
declare function setupChatMovement(): void;
declare function setup(): void;
