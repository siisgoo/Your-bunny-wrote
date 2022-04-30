// Object.defineProperty(jQuery.fn, 'onPositionChanged', function (trigger, millis) {
// @ts-ignore
jQuery.fn['onPositionChanged'] = function(trigger, millis?: number) {
    if (!millis) millis = 100;
    var o = $(this[0]); // our jquery object
    if (o.length < 1) return o;

    var lastPos: JQuery.Coordinates | undefined;
    var lastOff: JQuery.Coordinates | undefined;
    setInterval(function(): JQuery<HTMLElement> | void {
        if (!o || o.length < 1) return o; // abort if element is non existend eny more
        if (!lastPos) lastPos = o.position();
        if (!lastOff) lastOff = o.offset();
        var newPos = o.position();
        var newOff = o.offset();
        if (lastPos.top != newPos.top || lastPos.left != newPos.left) {
            // @ts-ignore
            $(this).trigger('onPositionChanged', { lastPos: lastPos, newPos: newPos  });
            if (typeof (trigger) == "function") trigger(lastPos, newPos);
            lastPos = o.position();
        }
        if (lastOff!.top != newOff!.top || lastOff!.left != newOff!.left) {
            // @ts-ignore
            $(this).trigger('onOffsetChanged', { lastOff: lastOff, newOff: newOff });
            if (typeof (trigger) == "function") trigger(lastOff, newOff);
            lastOff= o.offset();
        }
    }, millis);

    return o;
};
// });

export class DragDrop {
    private Active = false;
    private CurrentX: number = 0;
    private CurrentY: number = 0;
    private InitialX: number = 0;
    private InitialY: number = 0;
    private OffsetX = 0;
    private OffsetY = 0;

    private item: JQuery<HTMLElement>;
    private target: JQuery<HTMLElement>;
    private container: JQuery<HTMLElement>;

    constructor( item: JQuery<HTMLElement>, target: JQuery<HTMLElement>, container: JQuery<HTMLElement> = $("body")) {
        this.item = item;
        this.target = target;
        this.container = container;

        this.OffsetX = item.position().left;
        this.OffsetY = item.position().top;
        this.item.trigger("onPositionChanged");

        // @ts-ignore
        this.item.onPositionChanged(this.updateOffset.bind(this));

        this.container.on("touchstart", this.dragStart.bind(this));
        this.container.on("touchend",   this.dragEnd.bind(this));
        this.container.on("touchmove",  this.drag.bind(this));

        this.container.on("mousedown",  this.dragStart.bind(this));
        this.container.on("mouseup",    this.dragEnd.bind(this));
        this.container.on("mousemove",  this.drag.bind(this));
    }

    private dragStart(e: JQueryEventObject) {
        if (e.type === "touchstart") {
            // @ts-ignore
            this.InitialX = e.touches[0].clientX - this.OffsetX;
            // @ts-ignore
            this.InitialY = e.touches[0].clientY - this.OffsetY;
        } else {
            this.InitialX = e.clientX - this.OffsetX;
            this.InitialY = e.clientY - this.OffsetY;
        }

        if (e.target === this.target[0]) {
            // lock page scroll
            // @ts-ignore
            if (window['isMobile']) $("html").addClass("-is-locked");

            this.item.removeClass('drag-notactive');
            this.item.addClass('drag-active');
            this.Active = true;
        }
    }

    private dragEnd() {
        this.InitialX = this.CurrentX;
        this.InitialY = this.CurrentY;

        this.Active = false;

        // activate scroll
        // @ts-ignore
        if (window['isMobile']) $("html").removeClass("-is-locked");

        this.item.removeClass('drag-active');
        this.item.addClass('drag-notactive');
    }

    // TODO type
    private updateOffset(e: any) {
        this.OffsetX = e.left;
        this.OffsetY = e.top;
    }

    private drag(e: JQueryEventObject) {
        if (this.Active) {
            e.preventDefault();

            if (e.type === "touchmove") {
                // @ts-ignore
                this.CurrentX = e.touches[0].clientX - this.InitialX;
                // @ts-ignore
                this.CurrentY = e.touches[0].clientY - this.InitialY;
            } else {
                this.CurrentX = e.clientX - this.InitialX;
                this.CurrentY = e.clientY - this.InitialY;
            }

            this.CurrentX += window.pageXOffset;
            this.CurrentY -= window.pageYOffset;

            if (this.CurrentX+40 + (this.item.outerWidth() ?? 0) >= window.outerWidth) {
                this.CurrentX = window.outerWidth - 4 - (this.item.outerWidth() ?? 0);
            }

            if (this.CurrentX-40 <= 0) {
                this.CurrentX = 4;
            }

            if (this.CurrentY-40 <= 0) {
                this.CurrentY = 4;
            }

            if (this.CurrentY+40 + (this.item.outerHeight() ?? 0) >= window.outerHeight) {
                this.CurrentY = window.outerHeight - 4 - (this.item.outerHeight() ?? 0);
            }

            this.OffsetX = this.CurrentX;
            this.OffsetY = this.CurrentY;

            this.item.css("left", this.CurrentX);
            this.item.css("top", this.CurrentY);
        }
    }
};
