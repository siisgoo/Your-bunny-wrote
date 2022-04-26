import { Controller } from './Controller.js'
import { View } from './View.js'
import { Model } from './Model.js'

$(document).ready(function(){
    var model = new Model($("#chat-service-url").text().trim());
    var controler = new Controller(model);
    var view = new View(model);

    model.setView(view);
    view.setController(controler);
    view.init();
});

// type Listener = (...args: any[]) => void
// type Events = { [event: string]: Listener[]  };

// use https://gist.github.com/mudge/5830382
// class EventEmitter {
//     private readonly events: Events = {};

//     constructor() {
//     }

//     public on(event: string, listener: Listener): () => void {
//         if(typeof this.events[event] !== 'object') this.events[event] = [];

//         this.events[event].push(listener);
//         return () => this.removeListener(event, listener);
//     }

//     public removeListener(event: string, listener: Listener): void {
//         if(typeof this.events[event] !== 'object') return;
//         const idx: number = this.events[event].indexOf(listener);
//         if(idx > -1) this.events[event].splice(idx, 1);
//     }

//     public removeAllListeners(): void {
//         Object.keys(this.events).forEach((event: string) => 
//                                          this.events[event].splice(0, this.events[event].length)
//                                         );
//     }

//     public emit(event: string, ...args: any[]): void {
//         if(typeof this.events[event] !== 'object') return;
//         this.events[event].forEach(listener => listener.apply(this, args));
//     }

//     public once(event: string, listener: Listener): void {
//         const remove: (() => void) = this.on(event, (...args: any[]) => {
//             remove();
//             listener.apply(this, args);
//         });
//     }
// }

// interface botMessage {
//     text: string,
//     buttons?: ChatMessageButton[],
// }

