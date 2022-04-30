// import { Database } from './database.js'
// import { Config } from './Config.js'
// import * as fs from 'fs'

// const path = Config().server.fileStorage.path;
// const dirs = new Map<string, string>([
//     [ "base",        path ],
//     [ "images",      path + "/images" ],
//     [ "backgrounds", path + "/images/backgrounds" ]
// ])

// for (let [, path] of dirs) {
//     if (!fs.existsSync(path)) {
//         fs.mkdirSync(path, { recursive: true })
//     }
// }

// export let API = (() => {
//     function background(id?: number) {
//         if (id) {
//             Database.files.findOne({ file_id: id });
//         } else {

//         }
//     }

//     function image(id: number) {
//         if (id) {

//         }
//     }

//     return {
//         background,
//         image,
//     }
// })
