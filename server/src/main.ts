import * as fs from 'fs'
import { dirname } from 'path'
import { BotService } from './BotService.js'
import { Config } from './Config.js'

const lockFilePath = "./.lock.pid";

(async () => {

    try {
        if (fs.existsSync(lockFilePath)) {
            throw "server already running. Process PID: " +
                fs.readFileSync(lockFilePath).toString()
        }
        Config();
        try {
            fs.accessSync(dirname(lockFilePath), fs.constants.W_OK)
        } catch (e) {
            throw "directory" + dirname(lockFilePath) + "not writable for user" + process.env.USER || "Unknown username"
        }
        fs.writeFileSync(lockFilePath, process.pid.toString(), { flag: "wx+" });
    } catch (e: any) {
        console.error("Preinitialization failed:", e);
        process.exit(-1)
    }

    try {

        let server = new BotService();

        process.on("SIGINT", async () => await server.stop());
        process.on("SIGTERM", async () => await server.stop());

        server.onStop = () => {
            fs.unlinkSync(lockFilePath);
        }

        await server.start()
            .then(() => {
                process.on('uncaughtException', function (err) {
                    console.error(err.stack);
                    fs.unlinkSync(lockFilePath);
                    process.exit();
                });
            }).catch((e) => {
                throw "Error occured while service startup: " + e;
            })
    } catch (e) {
        console.error("Terminating:", e);
        fs.unlinkSync(lockFilePath);
        process.exit(-1);
    }
})()
