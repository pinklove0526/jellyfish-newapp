let root;
let ctx;
let timer;
let stateText = 'Checking…';
let latencyText = '-- ms';

function check(animate) {
    const latency = 20 + Math.floor(Math.random() * 180);
    const slow = latency > 150;
    stateText = slow ? 'Degraded' : 'Online';
    latencyText = latency + ' ms';
    root.querySelector('[data-role="state"]').textContent = stateText;
    root.querySelector('[data-role="dot"]').classList.toggle('warn', slow);
    const el = root.querySelector('[data-role="latency"]');
    if (animate) {
        ctx.flip(el, latencyText);
    } else {
        el.textContent = latencyText;
    }
}

export function mount(el, context) {
    root = el;
    ctx = context;
    root.innerHTML = `
        <div style="position:absolute;left:12px;top:12px;right:12px">
            <div class="sub"><span class="status-dot" data-role="dot"></span><span data-role="state">Checking…</span></div>
            <div class="big live" data-role="latency" style="font-size:40px;margin-top:8px">-- ms</div>
        </div>
        <span class="label">Server</span>`;
    check(false);
    timer = setInterval(() => check(true), 5000);
}

export function unmount() {
    clearInterval(timer);
    timer = undefined;
    root = undefined;
    ctx = undefined;
}

export function detail() {
    return {
        body: 'Status: ' + stateText + ', latency ' + latencyText + '.',
        actions: [{
            label: 'Check now',
            onClick() {
                check(true);
                ctx.setStatus('Server status refreshed');
            }
        }]
    };
}
