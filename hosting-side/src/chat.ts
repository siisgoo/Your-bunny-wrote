import { Controller } from './Controller.js'
import { View } from './View.js'
import { Model } from './Model.js'

let model: Model;

$(document).ready(function(){
    model = new Model(new URL($('#chat-ralay-url').text()));
    let controler = new Controller(model);
    let view = new View(model);

    view.setController(controler);
    view.init();
});

window.onunload = async () => {
    model.disconnect();
}
window.onbeforeprint = async () => {
    model.disconnect();
}
