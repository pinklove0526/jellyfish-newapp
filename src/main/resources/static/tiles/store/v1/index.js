export function mount(el) {
    el.innerHTML = `
        <div class="center">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 16h30l-3 24H12z"/><path d="M17 16v-3a7 7 0 0114 0v3"/></svg>
        </div>
        <span class="label">Store</span>`;
}

export function unmount() {
}

export function detail() {
    return { body: 'All your apps are up to date.' };
}
