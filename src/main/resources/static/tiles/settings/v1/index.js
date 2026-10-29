export function mount(el) {
    el.innerHTML = `
        <div class="center">
            <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11.3 11.3l4.2 4.2M32.5 32.5l4.2 4.2M11.3 36.7l4.2-4.2M32.5 15.5l4.2-4.2"/></svg>
        </div>
        <span class="label">Settings</span>`;
}

export function unmount() {
}

export function detail() {
    return { body: 'Live tiles refresh every few seconds. Click a tile to open its details.' };
}
