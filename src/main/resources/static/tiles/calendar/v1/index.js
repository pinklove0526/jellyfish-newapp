let root;
let timer;
let off;
let dueTasks = null;

function render() {
    const now = new Date();
    root.querySelector('[data-role="day"]').textContent = now.getDate();
    root.querySelector('[data-role="weekday"]').textContent =
        now.toLocaleDateString([], { weekday: 'long' });
}

function renderDue() {
    root.querySelector('[data-role="due"]').textContent =
        dueTasks === null ? '' : dueTasks + ' task' + (dueTasks === 1 ? '' : 's') + ' due';
}

export function mount(el, ctx) {
    root = el;
    dueTasks = null;
    root.innerHTML = `
        <div class="center">
            <div class="w3-center">
                <div class="big" data-role="day">--</div>
                <div class="sub" data-role="weekday">&nbsp;</div>
            </div>
        </div>
        <span data-role="due" style="position:absolute;left:12px;top:6px;font-size:11px;opacity:0.85"></span>
        <span class="label">Calendar</span>`;
    render();
    timer = setInterval(render, 60000);
    // Demo of the cross-tile bus: the tasks tile publishes, this tile listens.
    off = ctx.bus.on('tasks:changed', (detail) => {
        dueTasks = detail.remaining;
        renderDue();
    }, { replay: true });
}

export function unmount() {
    clearInterval(timer);
    timer = undefined;
    if (off) {
        off();
        off = undefined;
    }
    root = undefined;
}

export function detail() {
    const tasks = dueTasks === null ? '' : ' ' + dueTasks + ' task' + (dueTasks === 1 ? ' is' : 's are') + ' due (from the Tasks tile).';
    return { body: 'No events scheduled for ' + new Date().toLocaleDateString() + '.' + tasks };
}
