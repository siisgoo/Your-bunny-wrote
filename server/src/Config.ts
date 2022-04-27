import { min, pattern, Infer, assert, boolean, object, number, string } from 'superstruct';
import { readFileSync } from 'fs';

const ConfigSign = object({
    bot: object({
        token: pattern(string(), /^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$/),
        admin_id: number()
    }),

    server: object({
        database: object({
            saveChatHistory: boolean(),
            path: string(),
        }),

        fileStorage: object({
            path: string(),
        }),

        port: min(number(), 1000),

        subdomain: string(),
        domain: string(),
    })
})

type ConfigType = Infer<typeof ConfigSign>;

export function Config(): ConfigType {
    const config = JSON.parse(readFileSync("./config.json").toString());

    assert(config, ConfigSign);

    return config;
}
