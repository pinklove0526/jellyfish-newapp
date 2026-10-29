// Shell: fetches the manifest, draws an empty frame per enabled tile, then
// loads every tile as its own ES module. A tile module exports:
//   mount(el, ctx)  render into el and start any timers (may be async)
//   unmount()       stop timers and release anything mount() took
//   detail()        optional; {body, node, actions: [{label, onClick}]} for the panel
// ctx = { id, title, version, setStatus(message), flip(el, text), bus }
// ctx.bus is the cross-tile CustomEvent bus (see bus.js).
//
// Fault isolation: every tile loads, runs its detail() and its actions inside
// its own try/catch, and loading is bounded by TILE_TIMEOUT_MS. A tile that
// throws, hangs or 404s becomes an "unavailable" frame; the rest keep running.
//
// The shell publishes its own state as "shell:runtime" on the bus (a snapshot
// of the manifest request and of every tile's status), which the diagnostics
// tiles draw. Subscribe with { replay: true } to get the latest snapshot.

import { createBus } from './bus.js';

const $ = (id) => document.getElementById(id);
const bus = createBus();

const TILE_TIMEOUT_MS = 5000;
const SIZE_CLASS = { small: 'small-mobile', wide: 'wide', large: 'large' };

const runtime = {
    manifest: { status: 'loading', url: null, ms: null, reason: null },
    build: null,
    tiles: []
};

const modal = $('tile-modal');
const panel = $('modal-panel');
let lastFocused = null;

function publish() {
    bus.emit('shell:runtime', structuredClone(runtime));
}

function setStatus(message) {
    $('status-message').textContent = message;
}

// Fade the element out, swap its text, fade back in: the "live tile" flip.
function flip(el, text) {
    el.classList.add('flip');
    setTimeout(() => {
        el.textContent = text;
        el.classList.remove('flip');
    }, 300);
}

function describe(error) {
    return error && error.message ? error.message : String(error);
}

// --- Detail panel -----------------------------------------------------------

function openModal(frame, info) {
    const hasNode = info.node instanceof Node;
    panel.className = 'w3-modal-content w3-animate-right ' + frame.dataset.color + (hasNode ? ' wide-panel' : '');
    $('modal-title').textContent = frame.dataset.title;
    $('modal-body').textContent = info.body || '';
    $('modal-extra').replaceChildren(...(hasNode ? [info.node] : []));
    $('modal-meta').textContent = 'Module ' + frame.dataset.moduleUrl + ' · v' + frame.dataset.version;

    const actions = $('modal-actions');
    actions.replaceChildren();
    (info.actions || []).forEach((action) => {
        const btn = document.createElement('button');
        btn.className = 'w3-button w3-border w3-border-white w3-margin-right';
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
            try {
                action.onClick();
            } catch (error) {
                console.error('Tile action "' + action.label + '" failed:', error);
                setStatus('"' + action.label + '" failed: ' + describe(error));
            }
            closeModal();
        });
        actions.appendChild(btn);
    });

    lastFocused = frame;
    modal.style.display = 'block';
    $('modal-close').focus();
    setStatus('Opened ' + frame.dataset.title);
}

function closeModal() {
    modal.style.display = 'none';
    if (lastFocused) {
        lastFocused.focus();
    }
}

function safeDetail(mod, tile) {
    if (typeof mod.detail !== 'function') {
        return {};
    }
    try {
        return mod.detail() || {};
    } catch (error) {
        console.error('Tile "' + tile.id + '" detail() failed:', error);
        return { body: 'Details are unavailable: ' + describe(error) };
    }
}

// --- Tiles ------------------------------------------------------------------

function createFrame(tile) {
    const frame = document.createElement('button');
    frame.type = 'button';
    frame.className = 'tile ' + (SIZE_CLASS[tile.size] || SIZE_CLASS.small) + ' w3-win8-' + tile.color;
    frame.dataset.tile = tile.id;
    frame.dataset.title = tile.title;
    frame.dataset.color = 'w3-win8-' + tile.color;
    frame.dataset.version = tile.version;
    frame.dataset.moduleUrl = tile.moduleUrl;

    frame.addEventListener('pointerdown', () => frame.classList.add('pressed'));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
        frame.addEventListener(evt, () => frame.classList.remove('pressed'));
    });
    return frame;
}

function markUnavailable(frame, tile, reason) {
    const center = document.createElement('div');
    center.className = 'center';
    const inner = document.createElement('div');
    inner.className = 'w3-center';
    const heading = document.createElement('div');
    heading.className = 'sub';
    heading.textContent = 'Unavailable';
    const detail = document.createElement('div');
    detail.className = 'reason';
    detail.textContent = reason;
    inner.append(heading, detail);
    center.appendChild(inner);

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = tile.title;

    frame.replaceChildren(center, label);
    frame.classList.add('unavailable');
    frame.disabled = true;
    frame.title = tile.title + ': ' + reason;
}

async function loadTile(tile, frame, entry) {
    const started = performance.now();
    const ctx = { id: tile.id, title: tile.title, version: tile.version, setStatus, flip, bus };
    let mod;
    let timedOut = false;
    let timer;

    const work = (async () => {
        mod = await import(tile.moduleUrl);
        if (timedOut) {
            return;
        }
        if (typeof mod.mount !== 'function') {
            throw new TypeError('module has no mount()');
        }
        await mod.mount(frame, ctx);
    })();
    const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
            timedOut = true;
            reject(new Error('timed out after ' + TILE_TIMEOUT_MS + ' ms'));
        }, TILE_TIMEOUT_MS);
    });

    try {
        await Promise.race([work, deadline]);
        clearTimeout(timer);
        const badge = document.createElement('span');
        badge.className = 'version';
        badge.textContent = 'v' + tile.version;
        badge.title = tile.moduleUrl;
        frame.appendChild(badge);
        frame.addEventListener('click', () => openModal(frame, safeDetail(mod, tile)));
        entry.status = 'live';
    } catch (error) {
        // Only this tile is affected; the rest of the shell keeps running.
        clearTimeout(timer);
        console.error('Tile "' + tile.id + '" is unavailable:', error);
        try {
            // Let a tile that failed half-way stop whatever mount() already started.
            if (mod && typeof mod.unmount === 'function') {
                mod.unmount();
            }
        } catch (cleanupError) {
            console.error('Tile "' + tile.id + '" unmount() failed:', cleanupError);
        }
        entry.status = 'failed';
        entry.reason = describe(error);
        markUnavailable(frame, tile, entry.reason);
    }
    entry.ms = Math.round(performance.now() - started);
    publish();
}

function renderGroups(tiles) {
    const container = $('groups');
    const sections = new Map();
    const pending = [];

    tiles.forEach((tile, index) => {
        if (!tile.enabled) {
            return;
        }
        if (!sections.has(tile.group)) {
            const section = document.createElement('section');
            section.className = 'group';
            const heading = document.createElement('h2');
            heading.textContent = tile.group;
            const grid = document.createElement('div');
            grid.className = 'tiles';
            section.append(heading, grid);
            container.appendChild(section);
            sections.set(tile.group, grid);
        }
        const frame = createFrame(tile);
        sections.get(tile.group).appendChild(frame);
        pending.push(loadTile(tile, frame, runtime.tiles[index]));
    });

    return Promise.all(pending);
}

async function boot() {
    const started = performance.now();
    runtime.manifest.url = document.body.dataset.manifestUrl;
    publish();

    let manifest;
    try {
        const response = await fetch(runtime.manifest.url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        manifest = await response.json();
    } catch (error) {
        console.error('Manifest failed to load:', error);
        runtime.manifest.status = 'failed';
        runtime.manifest.reason = describe(error);
        runtime.manifest.ms = Math.round(performance.now() - started);
        publish();
        $('groups').textContent = 'The tile manifest is unavailable.';
        setStatus('Manifest unavailable');
        return;
    }

    const tiles = manifest.tiles || [];
    runtime.manifest.status = 'live';
    runtime.manifest.ms = Math.round(performance.now() - started);
    runtime.build = manifest.build || null;
    runtime.tiles = tiles.map((tile) => ({
        id: tile.id,
        title: tile.title,
        version: tile.version,
        moduleUrl: tile.moduleUrl,
        group: tile.group,
        status: tile.enabled ? 'loading' : 'disabled',
        reason: null,
        ms: null
    }));
    publish();

    await renderGroups(tiles);
    const failed = runtime.tiles.filter((entry) => entry.status === 'failed').length;
    setStatus(failed === 0 ? 'Ready' : 'Ready · ' + failed + (failed === 1 ? ' tile' : ' tiles') + ' unavailable');
}

// --- Wiring -----------------------------------------------------------------

$('modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
        closeModal();
    }
});

function updateStatusTime() {
    $('status-time').textContent = new Date().toLocaleTimeString();
}
updateStatusTime();
setInterval(updateStatusTime, 1000);

boot();
