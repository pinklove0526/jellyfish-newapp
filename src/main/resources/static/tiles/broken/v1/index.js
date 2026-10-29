// A deliberately broken tile. It starts a timer and then throws, to show that
// the shell marks only this tile as unavailable, stops the timer through
// unmount(), and keeps every other tile running. Set enabled: false in
// application.yml to hide it.
let timer;

export function mount() {
    timer = setInterval(() => {
        console.warn('broken tile: this timer should have been stopped by unmount()');
    }, 1000);
    throw new Error('deliberate failure in mount()');
}

export function unmount() {
    clearInterval(timer);
    timer = undefined;
}
