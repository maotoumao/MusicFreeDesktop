

const currentPressedKeys = new Set<string>();

export function setupLocalShortCut(){
    window.addEventListener('keydown', (e) => {
        if(e.key !== 'Backspace') {
            currentPressedKeys.add(e.key);
        }
    });

    window.addEventListener('keyup', (e) => {
        currentPressedKeys.delete(e.key);
    })
}

export function isKeyDown(key: string) {
    return currentPressedKeys.has(key);
}
