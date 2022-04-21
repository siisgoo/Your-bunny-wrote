import { assert, boolean, object, number, string } from 'superstruct';
import { readFileSync } from 'fs';

interface ConfigType {
    bot: {
        token: string,
        admin_id: number,
    }

    server: {
        database: {
            saveChatHistory: boolean
        },
        port: number
    }
}

const ConfigSign = object({
    bot: object({
        token: string(),
        admin_id: number()
    }),
    server: object({
        database: object({
            saveChatHistory: boolean()
        }),
        port: number()
    })
})

export function Config(): ConfigType {
    const config = JSON.parse(readFileSync("./config.json").toString());

    assert(config, ConfigSign);

    return config;
}
