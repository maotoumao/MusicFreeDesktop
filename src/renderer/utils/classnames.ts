export default function classNames(cls: Record<string, boolean> | Array<string>) {
    if(Array.isArray(cls)){
        return cls.join(" ");
    }
    return Object.getOwnPropertyNames(cls).filter(cl => cls[cl]).join(" ");
}