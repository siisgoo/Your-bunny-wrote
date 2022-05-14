import * as fs from 'fs'
import { dirname } from 'path'
import { BotService } from './BotService.js'
import { Config } from './Config.js'

const lockFilePath = "./.lock.pid";

(async () => {
    try {
        try {
            if (fs.existsSync(lockFilePath)) {
                throw "Server already running. Process PID: " +
                    fs.readFileSync(lockFilePath).toString()
            }
            Config();
            try {
                fs.accessSync(dirname(lockFilePath), fs.constants.W_OK)
            } catch (e) {
                throw "Directory" + dirname(lockFilePath) + "not writable for user" + process.env.USER || "Unknown username"
            }
            fs.writeFileSync(lockFilePath, process.pid.toString(), { flag: "wx+" });
        } catch (e: any) {
            throw "preinitialization failed: " + e;
        }

        try {
            let server = new BotService();

            process.on("SIGINT", async () => await server.stop());
            process.on("SIGTERM", async () => await server.stop());

            process.on('uncaughtException', function (err) {
                console.error(err.stack);
                fs.unlinkSync(lockFilePath);
            });

            server.onStop = () => {
                fs.unlinkSync(lockFilePath);
                console.log("Halted");
            }

            server.start();
        } catch (e) {
            console.error("Error occured while service startup: " + e);
        }
    } catch (e) {
        console.error("Terminated due error:", e);
    }
})()
