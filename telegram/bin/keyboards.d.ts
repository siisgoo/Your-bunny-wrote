declare const MainKeyboardMarkup: {
    text: string;
    callback_data: string;
}[][];
declare const InChatKeyboardMarkup: (chatHash: string) => {
    text: string;
    callback_data: string;
}[][];
