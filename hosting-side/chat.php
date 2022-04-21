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
    <div id="chat-box-body">
        <div id="chat-box-overlay">
        </div>
        <div id="chat-logs">
        </div>
    </div>
    <div id="chat-input-wrapper">
            <input type="text" id="chat-input" placeholder="Введите сообщение..."/>
            <button type="submit" id="chat-submit"><i class="material-icons">send</i></button>
    </div>
</div>
