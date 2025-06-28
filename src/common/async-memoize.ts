
export default function asyncMemoize<R, T extends (...args: any[]) => Promise<R>>(callback: T): T{
    let val: R;

    return (async (...args: any[]) => {
        if(!val) {
            val = await callback(...args);
        }

        return val;
    }) as T;
}
