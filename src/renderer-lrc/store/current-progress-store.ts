import Store from "@/common/store";

interface IProgressData {
        currentTime: number;
        duration: number;
}


export default new Store<IProgressData>({
    currentTime: 0,
    duration: 0
});