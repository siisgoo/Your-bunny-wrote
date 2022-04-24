interface cookieOptions {
    Domain: string,
    Path: string,
    Expires: string,
    Size: number,
    HttpOnly: boolean,
    Secure: boolean,
    SameSite: string
};

export const cookie = (() => {
    function get(name: string) {
        let matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    function set(name: string, value: string, options: Partial<cookieOptions>) {
        let def_options: Partial<cookieOptions> = {
            Path: '/',
            Secure: true,
            SameSite: "none",
            ...options,
        }

        let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);
        for (let optionKey in def_options) {
            updatedCookie += "; " + optionKey;
            // @ts-ignore
            let optionValue = def_options[optionKey];
            if (optionValue !== true) {
                updatedCookie += "=" + optionValue;
            }
        }
        document.cookie = updatedCookie;
    }

    function remove(name: string) { set(name, "", { Expires: new Date(-1).toUTCString() }); }

    return {
        get,
        set,
        remove
    }
})()
