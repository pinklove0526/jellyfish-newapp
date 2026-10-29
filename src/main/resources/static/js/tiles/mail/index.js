let root;
let ctx;
let timer;
let unread = 3;

function render() {
    root.querySelector('[data-role="count"]').textContent = unread;
}

function maybeNewMail() {
    if (Math.random() < 0.4) {
        unread += 1;
        render();
        ctx.setStatus('New message received');
    }
}

export function mount(el, context) {
    root = el;
    ctx = context;
    unread = 3;
    root.innerHTML = `
        <div class="center">
            <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="11" width="36" height="26"/><path d="M6 11l18 15 18-15"/></svg>
        </div>
        <span class="label">Mail</span>
        <span class="badge" data-role="count">0</span>`;
    render();
    timer = setInterval(maybeNewMail, 10000);
}

export function unmount() {
    clearInterval(timer);
    timer = undefined;
    root = undefined;
    ctx = undefined;
}

export function detail() {
    return {
        body: 'You have ' + unread + ' unread message' + (unread === 1 ? '' : 's') + '.',
        actions: [{
            label: 'Mark all read',
            onClick() {
                unread = 0;
                render();
                ctx.setStatus('All mail marked as read');
            }
        }]
    };
}
