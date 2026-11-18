import { getStat } from "./stat.js";
export async function exists(context, remotePath, options = {}) {
    try {
        await getStat(context, remotePath, options);
        return true;
    }
    catch (err) {
        if (err.status === 404) {
            return false;
        }
        throw err;
    }
}
