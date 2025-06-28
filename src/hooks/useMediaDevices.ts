import { useEffect, useState } from "react";

export function useOutputAudioDevices() {
    const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);

    useEffect(() => {
        navigator.mediaDevices
            .enumerateDevices()
            .then((res) => {
                setDevices(res.filter((item) => item.kind === "audiooutput"));
            })
            .catch(() => {})
            .finally(() => {});
    }, []);

    return devices;
}
