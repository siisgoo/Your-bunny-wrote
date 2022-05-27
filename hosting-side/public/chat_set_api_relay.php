<?php
$request = array_merge($_GET, $_POST, $_REQUEST, $_COOKIE);
if ($request['token'] === '') {
    require $_SERVER["DOCUMENT_ROOT"]."/php/connection.php";
    $stmt = mysqli_prepare($connection, "UPDATE chat SET url=?");
    mysqli_stmt_bind_param($stmt, 's', $request['url']);
    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['status'=>'ok']);
    } else {
        echo json_encode(['status'=>'error', 'text'=>$connection->error]);
    }
} else {
    $request_str="";
    foreach($request as $item){
        $request_str = $request_str . " " . $item;
    }
    echo json_encode([
        'status'=>'error',
        'text'=>'not valid token: ' . $request_str
    ]);
}
?>
