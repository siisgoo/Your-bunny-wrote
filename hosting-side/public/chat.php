<button id="chat-toggle">
    <div id="chat-control-panel">
        <div class="chat-control-panel-text">Онлайн: <span id="chat-managers-online-num">0</span></div>
        <div class="vertical-line"></div>
        <div class="chat-control-panel-text">Настройки </div>
        <i id="chat-save-session"  title="Разрешить сохранение сессии" class="chat-control-panel-button material-icons">fingerprint</i>
        <i id="chat-reset" title="Обнулить чат" class="chat-control-panel-button material-icons">delete</i>
        <div class="vertical-line"></div>
    </div>
    <div id="chat-toggle-text">
        Чат
    </div>
</button>

<?php
// save background capab may be aproached with cookie value
$root = $_SERVER["DOCUMENT_ROOT"];
$files = glob($root . "/rediirector/images/backgrounds/*");
$bg = "http://" . $_SERVER['SERVER_NAME'] . str_replace($root, "", $files[random_int(0, count($files)-1)]);
/* $bg = "http://" . $_SERVER['SERVER_NAME'] . '/rediirector/images/backgrounds/josdf.gif'; */
?>

<div id="chat-box"  class="drag-notactive">
    <div id="chat-box-header" class="noselect">
        Rediirector
        <div class="zig-zag"></div>
        <div id="chat-manager-name">Tech-bot</div>
        <div id="chat-widnow-control-panel">
            <span id="chat-vertical-maximize" class="chat-window-control-item"><i class="material-icons">fullscreen</i></span>
            <span id="chat-vertical-normal" class="chat-window-control-item"><i class="material-icons">fullscreen_exit</i></span>
        </div>
    </div>
    <div id="chat-box-body" <?php echo "style=\"background-size: cover;background-image: url(" . $bg . ")\"" ?> >
        <div id="chat-box-overlay">
        </div>
        <div id="chat-logs">
        <div id="chat-manager-state">
        </div>
        </div>
    </div>
    <div id="chat-input-wrapper">
            <input type="text" id="chat-input" placeholder="Введите сообщение..."/>
            <button type="submit" id="chat-submit"><i class="material-icons">send</i></button>
    </div>
</div>
