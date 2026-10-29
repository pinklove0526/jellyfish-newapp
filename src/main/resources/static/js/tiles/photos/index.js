const albums = ['Summer 2026 · 48 photos', 'Coastline · 12 photos', 'Family · 230 photos', 'Screenshots · 17 photos'];

let root;
let ctx;
let timer;
let index = 0;

export function mount(el, context) {
    root = el;
    ctx = context;
    index = 0;
    root.innerHTML = `
        <div style="position:absolute;left:12px;top:12px;right:12px">
            <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="9" width="38" height="30"/><circle cx="17" cy="20" r="4"/><path d="M5 35l12-10 9 7 6-5 11 8"/></svg>
            <div class="sub live" data-role="caption"></div>
        </div>
        <span class="label">Photos</span>`;
    root.querySelector('[data-role="caption"]').textContent = albums[index];
    timer = setInterval(() => {
        index = (index + 1) % albums.length;
        ctx.flip(root.querySelector('[data-role="caption"]'), albums[index]);
    }, 4000);
}

export function unmount() {
    clearInterval(timer);
    timer = undefined;
    root = undefined;
    ctx = undefined;
}

export function detail() {
    return { body: 'Showing album: ' + albums[index] + '.' };
}
