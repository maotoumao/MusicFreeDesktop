
let onNavigateHook: () => void;

window.addEventListener('hashchange', () => {
    if(onNavigateHook) {
        onNavigateHook();
        clearNavigateHook();
    }
})

function setNavigateHook(callback: () => void){
    onNavigateHook = callback;
}

function clearNavigateHook(){
    onNavigateHook = null;
}

export default {
    setNavigateHook,
    clearNavigateHook
}