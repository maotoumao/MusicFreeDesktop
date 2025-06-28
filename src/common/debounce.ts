import debounce from "lodash.debounce";

export default function (
    ...args: Parameters<typeof debounce>
): ReturnType<typeof debounce> {
    const [
        func,
        wait = 500,
        options = {
            leading: true,
            trailing: false,
        },
    ] = args;

    return debounce(func, wait, options);
}
