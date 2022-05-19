import { min, pattern, Infer, assert, boolean, object, number, string } from 'superstruct'
import { readFileSync } from 'fs'

const ConfigSign = object({
    bot: object({
        token: pattern(string(), /^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$/),
        admin_id: number()
    }),

    target: object({
        url: string(),
        scriptPath: string(),
        accessTocken: string()
    }),

    server: object({
        database: object({
            saveChatHistory: boolean(),
            path: string(),
        }),

        fileStorage: object({
            public_path: string(),
            path: string(),
        }),

        port: min(number(), 1000),

        subdomain: string(),
        domain: string(),
    })
})

type ConfigType = Infer<typeof ConfigSign>;

export function Config(): ConfigType {
    let config;
    try {
        config = JSON.parse(readFileSync("./config.json").toString());
    } catch(e) {
        throw new Error("Config parse error: " + e);
    }

    assert(config, ConfigSign);

    return config;
}
