import * as fs from 'fs';
import { dirname } from 'path';
import { BotService } from './BotService.js';

const lockFilePath = "./.lock.pid";

(async () => {
    try {
        if (fs.existsSync(lockFilePath)) {
            throw "Server already running. Process PID: " +
                          fs.readFileSync(lockFilePath).toString();
        }
        try {
            fs.accessSync(dirname(lockFilePath), fs.constants.W_OK)
        } catch (e) {
            throw "Directory" + dirname(lockFilePath) + "not writable for user" + process.env.USER || "Unknown username"
        }
        fs.writeFileSync(lockFilePath, process.pid.toString(), { flag: "wx+" });
    } catch (e) {
        console.error(e);
    }

    try {
        let server = new BotService();

        process.on("SIGINT", async () => await server.stop());
        process.on("SIGTERM", async () => await server.stop());

        server.onStop = () => {
            fs.unlinkSync(lockFilePath);
            console.log("Halted");
        }

        server.start();
    } catch (e) {
        console.error("Error occured while service running: " + e);
    } finally {
    }
})()
