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
    if (fs.existsSync(".lock.pid"))
    {
        console.error("Server already running. Process PID: ",
                      fs.readFileSync(".lock.pid").toString());
    }
    else
    {
        process.on('exit', () => die);

        fs.open(".lock.pid", 'w+', (err, fd) => {
            if (err) {
                die("Cannot open lock file: " + err.message);
            }

            if (fs.writeSync(fd, String(process.pid)) == 0) {
                die("Cannot write to lock file");
            }
            fs.close(fd);

            let serv = new BotService();
        });
    }
} catch (e) {
    die("Error ocupored while running bot: " + e);
}
