// use https://gist.github.com/mudge/5830382
type Listener = (...args: any[]) => void
type Events = { [event: string]: Listener[]  };

class BaseEventEmitter {
    private readonly events: Events = {};

    constructor() {
    }

    public on(event: string, listener: Listener): () => void {
        if(typeof this.events[event] !== 'object') this.events[event] = [];

        this.events[event].push(listener);
        return () => this.off(event, listener);
    }

    public off(event: string, listener: Listener): void {
        if(typeof this.events[event] !== 'object') return;
        const idx: number = this.events[event].indexOf(listener);
        if(idx > -1) this.events[event].splice(idx, 1);
    }

    public removeAllListeners(): void {
        Object.keys(this.events).forEach((event: string) =>
                                         this.events[event].splice(0, this.events[event].length)
                                        );
    }

    public emit(event: string, ...args: any[]): void {
        if(typeof this.events[event] !== 'object') return;
        this.events[event].forEach(listener => listener.apply(this, args));
    }

    public once(event: string, listener: Listener): void {
        const remove: (() => void) = this.on(event, (...args: any[]) => {
            remove();
            listener.apply(this, args);
        });
    }
}

// // - / - / - //

type EventMap = Record<string, any>;

type EventKey<T extends EventMap> = string & keyof T;
type EventReceiver<T> = (...params: T[]) => void;

interface Emitter<T extends EventMap> {
    on<K extends EventKey<T>>
        (eventName: K, fn: EventReceiver<T[K]>): void;
    off<K extends EventKey<T>>
        (eventName: K, fn: EventReceiver<T[K]>): void;
    emit<K extends EventKey<T>>
        (eventName: K, params: T[K]): void;
}

export class EventEmitter<T extends EventMap> implements Emitter<T> {
    private emitter = new BaseEventEmitter();
    on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>) {
        this.emitter.on(eventName, fn);
    }

    off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>) {
        this.emitter.off(eventName, fn);
    }

    emit<K extends EventKey<T>>(eventName: K, ...params: T[K][]) {
        this.emitter.emit(eventName, ...params);
    }
}
