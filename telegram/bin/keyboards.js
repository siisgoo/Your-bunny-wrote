"use strict";
const MainKeyboardMarkup = [
    [
        {
            text: "Перейти в онлайн",
            callback_data: "/goonline"
        },
        {
            text: "Перейти в оффлайн",
            callback_data: "/gooffline"
        }
    ],
    [
        {
            text: "Статус",
            callback_data: "/status"
        }
    ],
    [
        {
            text: "Чаты",
            callback_data: "/chats"
        }
    ],
    [
        {
            text: "Обновить аватар",
            callback_data: "/updateavatar"
        }
    ],
    [
        {
            text: "Отключиться от сервиса",
            callback_data: "/exit"
        }
    ]
];
const InChatKeyboardMarkup = (chatHash) => [
    [
        {
            text: "Загрузить полную историю",
            callback_data: "/history_" + chatHash
        }
    ],
    [
        {
            text: "Выйти",
            callback_data: "/leavechat"
        },
        {
            text: "Заверить",
            callback_data: "/closechat"
        }
    ]
];
