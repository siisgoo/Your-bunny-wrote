<?php
require $root."/php/connection.php";
if ($_POST['tocken'] === 'eylclm5F05x0G4RYvqhTVYHb3zomp6WewNfTRqSIbuXRHZgexwGP+phCRuCulmD6x62lwNKoKO1O5G60JSb19A1ivjFM6iZyRf') {
    $stmt = mysqli_prepare($connection, "SELECT url from chat");
    mysqli_stmt_bind_param($stmt, 's', $_POST['url']);
    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['status'=>'ok']);
    } else {
        echo json_encode(['status'=>'error']);
    }
} else {
    echo json_encode(['status'=>'error']);
}
?>
