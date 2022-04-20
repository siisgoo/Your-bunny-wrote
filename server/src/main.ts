import * as fs from 'fs';
import { BotService } from './BotService.js';

function die(msg?: string) {
    console.error("Daing");
    fs.unlinkSync(".lock.pid");
    if (msg) {
        console.error(msg);
        process.exit(-1);
    }
}

try {
    // if (fs.existsSync(".lock.pid"))
    // {
    //     console.error("Server already running. Process PID: ",
    //                   fs.readFileSync(".lock.pid").toString());
    // }
    // else
    // {
    //     process.on('exit', () => die);

    fs.writeFileSync(".lock.pid", process.pid.toString());
} catch (e) {
    die("Error occured while service startup: " + e);
}

try {
    let serv = new BotService();
} catch (e) {
    die("Error occured while service running: " + e);
}
