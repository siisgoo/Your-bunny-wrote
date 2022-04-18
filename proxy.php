<?php

header("Access-Control-Allow-Origin: *");
set_time_limit(60);
error_reporting(true);
ob_implicit_flush();
ignore_user_abort(true);

if (isset($_GET) OR isset($_POST) OR isset($_COOKIE)) {
    $params = array_merge($_COOKIE,$_POST, $_GET);
}

if (!isset($params['type'])) {
    echo json_encode(["code" => 1, "message" => "No type passed"]);
    exit();
}

$url = "https://38f1-185-253-102-98.ngrok.io";

function send(array $data, string $path) {
    global $url;
    $load = json_encode($data);
    $ch = curl_init($url . $path);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
    curl_setopt($ch, CURLOPT_POSTFIELDS, $load);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER,
        [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($load)
        ]
    );

    echo json_encode(curl_exec($ch));
    curl_close($ch);
}

$response = [];

switch ($params['type']) {
    case "connect":
        $hash = $params['chatHash'];
        if (!preg_match("/([a-z0-9]){13}/i", $hash)) {
            $hash = uniqid();
        }
        $response = [ "url" => $url . "/updates", "chatHash" => $hash ];
        break;

    case "message":
        send([ "chatHash" => $params['hash'], "message" => $params['message'] ], "/incoming");
        break;

    case "close":
        send([ "chatHash" => $params['hash'] ], "/closeChat");
        break;

    case "test":
        send([ "load" => time() ], "/chat");
        break;

    case "updateBotServerURL":
        break;

    default:
        echo json_encode([ "code" => "2", "message" => "Unknown type passed: " . $params['type'] ]);
        exit();
}

echo json_encode([ "code" => "0", "response" => $response ]);

?>
