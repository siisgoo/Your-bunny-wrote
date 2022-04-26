import { Model } from './Model.js'

export class Controller {
    constructor(private model: Model) {
    }

    receive(cmd: string, args?: any){
        var args = args || {};
        switch(cmd){
            case 'newMessage':
                this.model.sendMessage(args);
                break;
            case 'init':
                this.model.init();
                break;
            case 'resetChat':
                this.model.resetChat();
                break;
            // case 'lastMessageInput':
            //     Model.sendLastMessage();
            // break;
            // case 'autoComplete':
            //     Model.autoComplete(args);
            // break;
            default:
                'No action specified for ' + cmd + 'command';
                break;
        }
    }
}
