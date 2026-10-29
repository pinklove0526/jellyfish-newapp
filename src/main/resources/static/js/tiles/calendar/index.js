let root;
let timer;

function render() {
    const now = new Date();
    root.querySelector('[data-role="day"]').textContent = now.getDate();
    root.querySelector('[data-role="weekday"]').textContent =
        now.toLocaleDateString([], { weekday: 'long' });
}

export function mount(el) {
    root = el;
    root.innerHTML = `
        <div class="center">
            <div class="w3-center">
                <div class="big" data-role="day">--</div>
                <div class="sub" data-role="weekday">&nbsp;</div>
            </div>
        </div>
        <span class="label">Calendar</span>`;
    render();
    timer = setInterval(render, 60000);
}

export function unmount() {
    clearInterval(timer);
    timer = undefined;
    root = undefined;
}

export function detail() {
    return { body: 'No events scheduled for ' + new Date().toLocaleDateString() + '.' };
}
