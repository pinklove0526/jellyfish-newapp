let root;
let timer;

function render() {
    const now = new Date();
    root.querySelector('[data-role="time"]').textContent =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    root.querySelector('[data-role="date"]').textContent =
        now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function mount(el) {
    throw new Error('PROOF: deliberately broken clock tile');
    root = el;
    root.innerHTML = `
        <div class="center">
            <div class="w3-center">
                <div class="big" data-role="time">--:--</div>
                <div class="sub" data-role="date">&nbsp;</div>
            </div>
        </div>
        <span class="label">Clock</span>`;
    render();
    timer = setInterval(render, 1000);
}

export function unmount() {
    clearInterval(timer);
    timer = undefined;
    root = undefined;
}

export function detail() {
    return { body: 'Local time zone: ' + Intl.DateTimeFormat().resolvedOptions().timeZone + '.' };
}
