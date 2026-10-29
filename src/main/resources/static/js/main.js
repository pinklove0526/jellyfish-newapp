// Shell: fetches the manifest, draws an empty frame per enabled tile, then
// loads every tile as its own ES module. A tile module exports:
//   mount(el, ctx)  render into el and start any timers
//   unmount()       stop timers and release anything mount() took
//   detail()        optional; {body, actions: [{label, onClick}]} for the panel
// ctx = { id, title, version, setStatus(message), flip(el, text), bus }
// ctx.bus is the cross-tile CustomEvent bus (see bus.js).

import { createBus } from './bus.js';

const $ = (id) => document.getElementById(id);
const bus = createBus();

const SIZE_CLASS = { small: 'small-mobile', wide: 'wide', large: 'large' };

const modal = $('tile-modal');
const panel = $('modal-panel');
let lastFocused = null;

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

// --- Detail panel -----------------------------------------------------------

function openModal(frame, info) {
    panel.className = 'w3-modal-content w3-animate-right ' + frame.dataset.color;
    $('modal-title').textContent = frame.dataset.title;
    $('modal-body').textContent = info.body || '';
    $('modal-meta').textContent = 'Module ' + frame.dataset.moduleUrl + ' · v' + frame.dataset.version;

    const actions = $('modal-actions');
    actions.replaceChildren();
    (info.actions || []).forEach((action) => {
        const btn = document.createElement('button');
        btn.className = 'w3-button w3-border w3-border-white w3-margin-right';
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
            action.onClick();
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

async function loadTile(tile, frame) {
    try {
        const mod = await import(tile.moduleUrl);
        mod.mount(frame, { id: tile.id, title: tile.title, version: tile.version, setStatus, flip, bus });
        const badge = document.createElement('span');
        badge.className = 'version';
        badge.textContent = 'v' + tile.version;
        badge.title = tile.moduleUrl;
        frame.appendChild(badge);
        frame.addEventListener('click', () => {
            openModal(frame, typeof mod.detail === 'function' ? mod.detail() : {});
        });
    } catch (error) {
        // Only this tile is affected; the rest of the shell keeps running.
        console.error('Tile "' + tile.id + '" failed to load:', error);
        frame.disabled = true;
        frame.textContent = tile.title + ' is unavailable';
    }
}

function renderGroups(tiles) {
    const container = $('groups');
    const sections = new Map();
    const pending = [];

    tiles.filter((tile) => tile.enabled).forEach((tile) => {
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
        pending.push(loadTile(tile, frame));
    });

    return Promise.all(pending);
}

async function boot() {
    let manifest;
    try {
        const response = await fetch(document.body.dataset.manifestUrl, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        manifest = await response.json();
    } catch (error) {
        console.error('Manifest failed to load:', error);
        $('groups').textContent = 'The tile manifest is unavailable.';
        setStatus('Manifest unavailable');
        return;
    }
    await renderGroups(manifest.tiles || []);
    setStatus('Ready');
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
