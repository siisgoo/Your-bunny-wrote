
        $("#chat-save-session").on("click", () => {
            if (cookie.get("saveChatSession") == "true") {
                cookie.set("saveChatSession", "false", {});
                $("#chat-save-session").removeClass("chat-settings-active");
                $("#chat-save-session").addClass("chat-settings-diactive");
                // botMessages.historyTurnDelete();
            } else {
                cookie.set("saveChatSession", "true", {});
                $("#chat-save-session").removeClass("chat-settings-diactive");
                $("#chat-save-session").addClass("chat-settings-active");
                // botMessages.historyTurnSave();
            }
        });

        $("#chat-reset").on("click", () => this.emit("reset"));
        $("#chat-toggle").hover(
            () => {
                this.stillHovered = true;
                if (this.opened) {
                    this.show();
                } else {
                    setTimeout(() => {
                        if (this.stillHovered) {
                            this.opened = true
                            this.show();
                        }
                    }, 1050)
                }
            },
            () => {
                this.stillHovered = false;
                this.hide();
            }
        );

        $("#chat-toggle-text").on("click", ev => this.emit("toggle"));

        // hide
        $("#chat-toggle").css("left", -$("#chat-toggle").width());
        // show
        this.adjust(1000);

        // show chat
        $("#chat-box").animate({opacity: 1}, 1000);
