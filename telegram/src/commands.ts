// import * as Keyboard from 'keyboards';
import { Telegraf } from 'telegraf';
import { managerStatus, chatStatus, messageStatus } from './constants.js';
import * as sqlite3 from 'sqlite3';

// class cmdGoOnline {
//     public const description = "Перейти в онлайн режим";
//     public const name = "/goonline";

//     public function exec($chatId, $message) {
//         global $managerOnline;
//         global $managerInChat;

//         global $tbAPIToken;
//         $tb = new telegramBot($tbAPIToken);
//         $db = tbDatabase();

//         $stmt = $db->prepare("SELECT mStatus FROM Managers WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mChatId"=>$chatId));
//         if ($stmt->fetch()["mStatus"] == $managerInChat) {
//             $tb->sendMessage($chatId, "Сменить статус будет возможно только после завершения диолога");
//             return;
//         }

//         $stmt=$db->prepare("UPDATE Managers SET mStatus=:mStatus WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mStatus"=>$managerOnline, ":mChatId"=>$chatId));
//         $tb->sendMessage($chatId, "Вы в онлайн режиме, вы будите получать оповещения о новых запросах.");
//     }
// }

// class cmdGoOffline {
//     public const description = "Перейти в оффлайн";
//     public const name = "/gooffline";

//     public function exec($chatId, $message) {
//         global $managerOffline;
//         global $managerInChat;

//         global $tbAPIToken;
//         $tb = new telegramBot($tbAPIToken);
//         $db = tbDatabase();

//         $stmt = $db->prepare("SELECT mStatus FROM Managers WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mChatId"=>$chatId));
//         if ($stmt->fetch()["mStatus"] == $managerInChat) {
//             $tb->sendMessage($chatId, "Сменить статус будет возможно только после завершения диолога");
//             return;
//         }

//         $stmt=$db->prepare("UPDATE Managers
//             SET mStatus=:mStatus, mSiteChatId=:mSiteChatId
//             WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mStatus"=>$managerOffline,":mSiteChatId"=>null, ":mChatId"=>$chatId));
//         $tb->sendMessage($chatId, "Вы в оффлайн режиме");
//     }
// }

// class cmdSelfRevoke {
//     public const description = "Отказать от прав использования бота";
//     public const name = "/selfrevoke";

//     public function exec($chatId, $message) {
//         global $managerInChat;
//         global $tbAPIToken;
//         $tb = new telegramBot($tbAPIToken);
//         $db = tbDatabase();

//         $stmt = $db->prepare("SELECT mStatus FROM Managers WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mChatId"=>$chatId));
//         if ($stmt->fetch()["mStatus"] == $managerInChat) {
//             $tb->sendMessage($chatId, "Сменить статус будет возможно только после завершения диолога");
//             return;
//         }

//         $stmt=$db->prepare("DELETE FROM Managers WHERE mChatId=:mChatId;");
//         $stmt->execute(array(":mChatId"=>$chatId));
//         $tb->sendMessage($chatId, "Пока-пока");
//     }
// }

// class cmdGetStatus {
//     public const description = "Узнать текущий статус";
//     public const name = "/status";

//     public function exec($chatId, $message) {

//         global $tbAPIToken;
//         $tb = new telegramBot($tbAPIToken);
//         $db = tbDatabase();

//         $stmt=$db->prepare("SELECT mStatus FROM Managers WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mChatId"=>$chatId));

//         global $managerOnline;
//         global $managerOffline;
//         global $managerInChat;

//         $msg;
//         switch ($stmt->fetch()[0]) {
//         case $managerInChat: $msg = "Вы разговариваете с человеком";
//         break;
//         case $managerOnline: $msg = "Вы в онлайн режиме";
//         break;
//         case $managerOffline: $msg = "Вы в оффлайн режиме";
//         break;
//         default: $msg = "Ошибка! Не известный статус.";
//         break;
//         }

//         $tb->sendMessage($chatId, $msg);
//     }
// }

// class cmdShowChats {
//     public const description = "Показать информацию о чатах";
//     public const name = "/chats";

//     public function exec($chatId, $message) {

//     }
// }

// class cmdEnterChat {
//     public const description = "Перейти в чат";
//     public const name = "/enterchat_";

//     public function exec($chatId, $message) {
//         global $managerInChat;
//         global $chatStatePending;
//         global $chatStateInConversation;

//         // TODO reject enter new chat if already in chat

//         global $tbAPIToken;
//         $tb = new telegramBot($tbAPIToken);
//         $db = tbDatabase();

//         $chatHash = mb_substr($message['text'], strlen("/enterchat_"));

//         $stmt=$db->prepare("SELECT chId as id, count(*) as count FROM Chats WHERE chHash=:chHash");
//         $stmt->execute(array(":chHash"=>$chatHash));
//         $res=$stmt->fetch();

//         // chat exists
//         if ($res['count'] != 0) {
//             openInChatKeyboard($tb, $chatId, $chatHash);

//             $chId = $res['id'];

//             $stmt = $db->prepare("SELECT chState as state FROM Chats WHERE chId=:chId");
//             $stmt->execute(array(":chId"=>$chId));
//             $res = $stmt->fetch();

//             // if chat pending to serve by manager
//             if ($res['state'] === $chatStatePending) {
//                 $stmt=$db->prepare("UPDATE Managers
//                     SET mSiteChatId=:mSiteChatId, mStatus=:mStatus
//                     WHERE mChatId=:mChatId");
//                 $stmt->execute(array(
//                     ":mSiteChatId"=>$chId,
//                     ":mStatus"=>$managerInChat,
//                     ":mChatId"=>$chatId));

//                 $stmt=$db->prepare("UPDATE Chats
//                     SET chState=:chState
//                     WHERE chId=:chId");
//                 $stmt->execute(array(
//                     ":chId"=>$chId,
//                     ":chState"=>$chatStateInConversation));

//                 $tb->sendMessage($chatId, "Вы вошли в чат с клиентом.");
//                 $tb->sendMessage($chatId, "Загружаем историю переписки с ботом...\n\n" .
//                     "Для ознакомления со всей историей переписки с данным клиентом, используйте команду /history_" . $chatHash);

//                 // load history to manager
//                 global $messageStateNotServed;
//                 global $messageStateServed;
//                 $stmt = $db->prepare('SELECT * FROM Messages
//                                       WHERE (msgFrom="c" OR msgFrom="b") AND
//                                             msgStatus=:msgStatus AND
//                                             msgChatId=:chId');
//                 $stmt->execute(array(":msgStatus"=>$messageStateNotServed, ":chId"=>$chId));

//                 $history = "";
//                 while ($res = $stmt->fetch()) {
//                     $historyMessage = gmdate("Y-m-d\TH:i:s\Z", $res['msgTime']) . " - " .
//                                       $res['msgCreator'] .":\n" . $res['msgText'] . "\n\n";
//                     if (strlen($historyMessage) > 4095) { // https://limits.tginfo.me/en
//                         $tb->sendMessage($chatId, $history);
//                         $history = "";
//                     } else {
//                         $history .= $historyMessage;
//                     }

//                     // TODO make its some sort of easy
//                     $anstmt=$db->prepare("UPDATE Messages SET msgStatus=:msgStatus WHERE msgChatId=:msgChatId AND msgTime=:msgTime AND msgText=:msgText");
//                     $anstmt->execute(array(
//                         ":msgStatus"=>$messageStateServed,
//                         ":msgChatId"=>$res['msgChatId'],
//                         ":msgTime"=>$res['msgTime'],
//                         ":msgText"=>$res['msgText'] ));
//                 }
//                 if (strlen($history) > 0) {
//                     $tb->sendMessage($chatId, $history);
//                 }

//                 // remove request messages
//                 $stmt = $db->prepare("SELECT chatId, msgId FROM pendingReqMessages WHERE target=:target");
//                 $stmt->execute(array(":target"=>$chatHash));

//                 while ($res = $stmt->fetch()) {
//                     $tb->deleteMessage($res['chatId'], $res['msgId']);
//                 }

//                 $stmt = $db->prepare("DELETE FROM pendingReqMessages WHERE target=:target");
//                 $stmt->execute(array(":target"=>$chatHash));
//             } else {
//                 $tb->sendMessage($chatId, "Чат закрыт или находится под распоряжением другого менеджера");
//             }
//         } else {
//             $tb->sendMessage($chatId, "Чат не существует");
//         }
//     }
// }

// class cmdLeaveChat {
//     public const description = "Покинуть текущий чат, предать права другому менеджеру";
//     public const name = "/leavechat";

//     public function exec($chatId, $message) {
//         global $managerOnline;

//         global $tbAPIToken;
//         $tb = new telegramBot($tbAPIToken);
//         $db = tbDatabase();

//         $sth=$db->prepare("SELECT mSiteChatId FROM Managers
//             WHERE mChatId=:mChatId");
//         $sth->execute(array(":mChatId"=>$chatId));
//         if ($sth->fetch()['mSiteChatId'] == null) {
//             $tb->sendMessage($chatId, "Вы не можете покинуть чат не находясь в нем");
//             return;
//         }

//         openMainKeyboard($tb, $chatId, "Чат покинут");

//         // TODO remove with function, its used in tbNewPendingCustomer.php
//         $sth=$db->prepare("SELECT mId, mName, mChatId FROM Managers
//             WHERE mStatus=:mStatus");
//         $sth->execute(array(":mStatus"=>$managerOnline));
//         $managers=array();

//         while ($res=$sth->fetch()) {
//             $managers[] = $res;
//         }

//         foreach($managers as $manager) {
//             $keyboard = array(
//                 array(
//                     array(
//                         "text" => "Войти в чат",
//                         "callback_data" => "/enterchat_" . $chHash
//                     ),
//                     array(
//                         "text" => "Отклонить",
//                         "callback_data" => "/discard_conversation_" . $chHash
//                     )
//                 )
//             );
//             $tb->sendMessage($chatId, "Новый клиент ожидает помощи",
//                 false, 0,
//                 $tb->replyInlineKeyboardMarkup($keyboard));
//         }

//         // get attached manager conversation chat id
//         $stmt = $db->prepare("SELECT mSiteChatId FROM Managers WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mChatId"=>$chatId));
//         $chId = $stmt->fetch()['mSiteChatId'];

//         // reset manager
//         $stmt = $db->prepare("UPDATE Managers
//             SET mStatus=:mStatus, mSiteChatId=NULL
//             WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mStatus"=>$managerOnline, ":mChatId"=>$chatId));

//         global $chatStatePending;

//         // set chat state to pending
//         $stmt = $db->prepare("UPDATE Chats
//             SET chState=:chState
//             WHERE chId=:chId");
//         $stmt->execute(array(":chState"=>$chatStatePending, ":chId"=>$chId));
//     }
// }

// class cmdCloseChat {
//     public const description = "Завершить текущий чат";
//     public const name = "/closechat";

//     public function exec($chatId, $message) {
//         global $managerOnline;
//         global $chatStateClosed;
//         global $messageStateServed;

//         global $tbAPIToken;
//         $tb = new telegramBot($tbAPIToken);
//         $db = tbDatabase();

//         $sth=$db->prepare("SELECT mSiteChatId FROM Managers
//             WHERE mChatId=:mChatId");
//         $sth->execute(array(":mChatId"=>$chatId));
//         if ($sth->fetch()['mSiteChatId'] == null) {
//             $tb->sendMessage($chatId, "Вы не можете закрыть чат не находясь в нем");
//             return;
//         }

//         openMainKeyboard($tb, $chatId, "Чат завершен");

//         $stmt = $db->prepare("SELECT mSiteChatId as chId FROM Managers
//             WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mChatId"=>$chatId));
//         $chId = $stmt->fetch()['chId'];

//         // unset manager from chat
//         $stmt=$db->prepare("UPDATE Managers
//             SET mStatus=:mStatus, mSiteChatId=NULL
//             WHERE mChatId=:mChatId");
//         $stmt->execute(array(":mStatus"=>$managerOnline, ":mChatId"=>$chatId));

//         global $chatStateClosed;

//         // set chat to closed state
//         $stmt=$db->prepare("UPDATE Chats
//             SET chState=:chState
//             WHERE chId=:chId");
//         $stmt->execute(array(":chState"=>$chatStateClosed, ":chId"=>$chId));

//         // set all post messages to served
//         $stmt=$db->prepare("UPDATE Messages
//             SET msgStatus=:msgStatus
//             WHERE msgChatId=:chId");
//         $stmt->execute(array(":msgStatus"=>$messageStateServed, ":chId"=>$chId));
//     }
// }

// class cmdUpdateAvatar {
//     public const description = "Обновить аватар на текущий в профиле";
//     public const name = "/updateavatar";

//     public function exec($chatId, $message) {
//         global $managersAvatarsDir;
//         global $tbAPIToken;

//         global $tbAPIToken;
//         $tb = new telegramBot($tbAPIToken);
//         $db = tbDatabase();

//         $userId = $message['from']['id'];
//         $fileId = $tb->getUserProfilePhotos($userId, null, 1)['result']['photos'][0][0]['file_id'];
//         $filePath = $tb->getFile($fileId)['result']['file_path'];
//         if ($filePath != null) {
//             $fileUrl = "https://api.telegram.org/file/bot" . $tbAPIToken . "/" . $filePath;
//             file_put_contents($managersAvatarsDir . "/" . $chatId, file_get_contents($fileUrl));
//         } else {
//             // TODO put default
//         }
//     }
// }

// class cmdShowHelp {
//     public const description = "Справка";
//     public const name = "/help";

//     public function exec($chatId, $message) {
//         global $tbAPIToken;
//         $tb = new telegramBot($tbAPIToken);
//         $db = tbDatabase();

//         global $version;
//         $helpMessage = "Tech-bot " . $version . "\n" .
//             "Чат-бот для использования внутри организации ЧПОУ \"ТИТ\"\n\n" .
//             "На данный момент доступны следующие команнды:\n";

//         global $commandsList;
//         foreach ($commandsList as $cmd) {
//             $helpMessage .= $cmd::name . " - " . $cmd::description . "\n";
//         }

//         $tb->sendMessage($chatId, $helpMessage);
//     }
// }

// $commandsList = array(
//     new cmdGoOnline(),
//     new cmdGoOffline(),
//     new cmdGetStatus(),
//     new cmdSelfRevoke(),
//     new cmdEnterChat(),
//     new cmdLeaveChat(),
//     new cmdCloseChat(),
//     new cmdShowChats(),
//     new cmdShowHelp()
// );

// class Commands {
//     protected $commands;

//     public function __construct() {
//         global $commandsList;
//         $this->commands = $commandsList;
//     }

//     public function exec($name, $chatId, $msgObj) {
//         foreach ($this->commands as $cmd_obj) {
//             // awoiding commands with self-contain parameter
//             if ($cmd_obj::name === mb_substr($name, 0, strlen($cmd_obj::name))) {
//                 $cmd_obj->exec($chatId, $msgObj);
//                 return "ok";
//             }
//         }
//         return null;
//     }
// }
