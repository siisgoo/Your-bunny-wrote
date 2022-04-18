export var managerStatus;
(function (managerStatus) {
    managerStatus[managerStatus["offline"] = 0] = "offline";
    managerStatus[managerStatus["online"] = 1] = "online";
    managerStatus[managerStatus["inChat"] = 2] = "inChat";
})(managerStatus || (managerStatus = {}));
;
export var chatStatus;
(function (chatStatus) {
    chatStatus[chatStatus["closed"] = 0] = "closed";
    chatStatus[chatStatus["pending"] = 1] = "pending";
    chatStatus[chatStatus["active"] = 2] = "active";
})(chatStatus || (chatStatus = {}));
;
export var messageStatus;
(function (messageStatus) {
    messageStatus[messageStatus["handled"] = 0] = "handled";
    messageStatus[messageStatus["unHandled"] = 1] = "unHandled";
})(messageStatus || (messageStatus = {}));
;
