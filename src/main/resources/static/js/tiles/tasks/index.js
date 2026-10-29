let root;
let ctx;
let remaining = 5;

function render() {
    root.querySelector('[data-role="count"]').textContent = remaining;
}

export function mount(el, context) {
    root = el;
    ctx = context;
    remaining = 5;
    root.innerHTML = `
        <div class="center">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 25l9 9 19-20"/></svg>
        </div>
        <span class="label">Tasks</span>
        <span class="badge" data-role="count">0</span>`;
    render();
}

export function unmount() {
    root = undefined;
    ctx = undefined;
}

export function detail() {
    return {
        body: remaining > 0 ? remaining + ' task' + (remaining === 1 ? '' : 's') + ' left today.' : 'All caught up.',
        actions: remaining > 0 ? [{
            label: 'Complete one',
            onClick() {
                remaining -= 1;
                render();
                ctx.setStatus('Task completed — ' + remaining + ' left');
            }
        }] : []
    };
}
