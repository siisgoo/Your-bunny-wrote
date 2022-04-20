interface ChatMessage {
    id: number;
    text: string;
    from: "bot" | "customer" | "manager";
    creator: string;
    time: number;
    avatarUrl?: string;
}

interface ServerMessage {
    event: "";
    payload?: any;
}

type ServerDisconnectReason = "Timeout";
type ClientDisconnectReason = "Chat-completed";
