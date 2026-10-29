const tracks = ['Ocean Drift · Tidal', 'Neon Rain · Static Bloom', 'Blue Hour · Coral Lane', 'Undertow · The Medusae'];

let root;
let ctx;
let index = -1;

export function mount(el, context) {
    root = el;
    ctx = context;
    index = -1;
    root.innerHTML = `
        <div style="position:absolute;left:12px;top:12px;right:12px">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 34V10l20-4v24"/><circle cx="13" cy="34" r="5"/><circle cx="33" cy="30" r="5"/></svg>
            <div class="sub live" data-role="track">Nothing playing</div>
        </div>
        <span class="label">Music</span>`;
}

export function unmount() {
    root = undefined;
    ctx = undefined;
}

export function detail() {
    return {
        body: index < 0 ? 'Nothing playing.' : 'Now playing: ' + tracks[index] + '.',
        actions: [{
            label: index < 0 ? 'Play' : 'Next track',
            onClick() {
                index = (index + 1) % tracks.length;
                ctx.flip(root.querySelector('[data-role="track"]'), tracks[index]);
                ctx.setStatus('Playing ' + tracks[index]);
            }
        }]
    };
}
