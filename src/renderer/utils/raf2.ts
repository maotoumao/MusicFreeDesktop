export default function (fn: (...args: any) => void) {
    requestAnimationFrame(() => {
        requestAnimationFrame(fn);
    });
}
