type FileMimeType = "PDF" | "DOC";
type SenderType = "bot" | "customer" | "manager";

interface ChatMessage {
    id: number,
    stamp: number,
    from: {
        // type: SenderType,
        type: string,
        name: string,
    }

    text?: string | null,

    image?: {
        file_id: number
        file_size: number,
    } | null,

    file?: {
        file_id: number,
        file_size: number,
        // mime: FileMimeType,
        mime: string,
    } | null,

    voice?: {
        file_id: number,
        file_size: number,
        duration: number,
    } | null,

    avatar?: {
        file_id: number;
    } | null
}

type ServerEvent = "answer" | "accepted" | "leaved" | "created" | "restored";

interface ServerMessage {
    event: ServerEvent;
    payload?: object;
}

type ServerDisconnectReason = "Timeout" | "ClosedByManager";
type ClientDisconnectReason = "EndChat" | "Reloading";
