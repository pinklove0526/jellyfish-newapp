// Runtime graph: shell -> manifest -> tiles, with the live/failed status the
// shell publishes as "shell:runtime". The tile face is a summary; the detail
// panel draws the full graph.
const SVG_NS = 'http://www.w3.org/2000/svg';
const COLOR = { live: '#60a917', failed: '#e51400', disabled: '#8a8a8a', loading: '#f0a30a' };

let root;
let off;
let snapshot = null;

function svg(name, attrs, text) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== undefined) {
        el.textContent = text;
    }
    return el;
}

function counts(tiles) {
    const result = { live: 0, failed: 0, disabled: 0, loading: 0 };
    tiles.forEach((tile) => { result[tile.status] += 1; });
    return result;
}

// One status for the whole tile layer: any failure outranks loading outranks live.
function overall(c) {
    if (c.failed > 0) {
        return 'failed';
    }
    return c.loading > 0 ? 'loading' : 'live';
}

function renderFace() {
    const ratio = root.querySelector('[data-role="ratio"]');
    const caption = root.querySelector('[data-role="caption"]');
    const chain = root.querySelector('[data-role="chain"]');
    chain.replaceChildren();
    if (!snapshot) {
        ratio.textContent = '–';
        caption.textContent = 'waiting for the shell';
        return;
    }
    const c = counts(snapshot.tiles);
    const enabled = snapshot.tiles.length - c.disabled;
    ratio.textContent = c.live + '/' + enabled;
    caption.textContent = c.failed > 0 ? 'tiles live · ' + c.failed + ' failed' : 'tiles live';

    const nodes = [['Shell', 'live'], ['Manifest', snapshot.manifest.status], ['Tiles', overall(c)]];
    chain.appendChild(svg('line', { x1: 20, y1: 10, x2: 180, y2: 10, stroke: '#fff', 'stroke-width': 1.5, opacity: 0.6 }));
    nodes.forEach(([name, status], i) => {
        const x = 20 + i * 80;
        const ok = status === 'live';
        chain.appendChild(svg('circle', {
            cx: x, cy: 10, r: 7, fill: ok ? '#fff' : '#1d1d1d', stroke: '#fff', 'stroke-width': 2,
            'stroke-dasharray': status === 'loading' ? '3 2' : 'none'
        }));
        if (status === 'failed') {
            chain.appendChild(svg('path', { d: 'M' + (x - 3) + ' 7l6 6M' + (x + 3) + ' 7l-6 6', stroke: '#fff', 'stroke-width': 1.6 }));
        }
        chain.appendChild(svg('text', { x, y: 31, 'text-anchor': 'middle', fill: '#fff', stroke: 'none', 'font-size': 10 }, name));
    });
}

function node(g, x, y, w, h, status, label, right) {
    g.appendChild(svg('rect', { x, y, width: w, height: h, fill: '#2b2b2b', stroke: COLOR[status], 'stroke-width': 1.5 }));
    g.appendChild(svg('circle', {
        cx: x + 11, cy: y + h / 2, r: 4, fill: status === 'live' || status === 'failed' ? COLOR[status] : 'none',
        stroke: COLOR[status], 'stroke-width': 1.5
    }));
    g.appendChild(svg('text', { x: x + 22, y: y + h / 2 + 4, fill: '#fff', 'font-size': 12 }, label));
    if (right) {
        g.appendChild(svg('text', { x: x + w - 8, y: y + h / 2 + 4, fill: '#bbb', 'font-size': 11, 'text-anchor': 'end' }, right));
    }
}

function buildGraph() {
    const tiles = snapshot.tiles;
    const rowH = 26;
    const pad = 16;
    const height = pad * 2 + Math.max(tiles.length, 1) * rowH;
    const cy = height / 2;
    const g = svg('svg', { viewBox: '0 0 600 ' + height, role: 'img', 'aria-label': 'Runtime graph of the shell, the manifest and each tile' });
    g.style.width = '100%';
    g.style.height = 'auto';
    g.style.display = 'block';

    const manifestStatus = snapshot.manifest.status;
    g.appendChild(svg('line', { x1: 96, y1: cy, x2: 170, y2: cy, stroke: COLOR[manifestStatus], 'stroke-width': 2 }));
    tiles.forEach((tile, i) => {
        const ty = pad + i * rowH + 3;
        g.appendChild(svg('path', {
            d: 'M280 ' + cy + ' C330 ' + cy + ' 330 ' + (ty + 10) + ' 380 ' + (ty + 10),
            fill: 'none', stroke: COLOR[tile.status], 'stroke-width': 1.5,
            'stroke-dasharray': tile.status === 'failed' ? '5 3' : tile.status === 'disabled' ? '2 4' : 'none'
        }));
    });
    node(g, 12, cy - 15, 84, 30, 'live', 'Shell');
    node(g, 170, cy - 15, 110, 30, manifestStatus, 'Manifest');
    tiles.forEach((tile, i) => {
        const timing = tile.status === 'live' && tile.ms !== null ? ' · ' + tile.ms + ' ms' : '';
        const label = tile.title.length > 17 ? tile.title.slice(0, 16) + '…' : tile.title;
        node(g, 380, pad + i * rowH + 3, 208, 20, tile.status, label, tile.status + timing);
    });
    return g;
}

function buildDetail() {
    const wrap = document.createElement('div');
    wrap.style.background = '#1d1d1d';
    wrap.style.padding = '8px';
    wrap.appendChild(buildGraph());

    const m = snapshot.manifest;
    const lines = ['Manifest ' + m.url + ': ' + m.status + (m.ms !== null ? ' in ' + m.ms + ' ms' : '') + (m.reason ? ' (' + m.reason + ')' : '')];
    snapshot.tiles.filter((tile) => tile.status === 'failed')
        .forEach((tile) => lines.push(tile.title + ' failed: ' + tile.reason));
    lines.forEach((line) => {
        const p = document.createElement('p');
        p.style.cssText = 'margin:6px 0 0;font-size:12px;color:#ddd';
        p.textContent = line;
        wrap.appendChild(p);
    });
    return wrap;
}

export function mount(el, ctx) {
    root = el;
    root.innerHTML = `
        <div class="center">
            <div class="w3-center">
                <div class="big" data-role="ratio">–</div>
                <div class="sub" data-role="caption">&nbsp;</div>
                <svg data-role="chain" viewBox="0 0 200 36" style="width:200px;height:36px;margin-top:14px" aria-hidden="true"></svg>
            </div>
        </div>
        <span class="label">Runtime graph</span>`;
    off = ctx.bus.on('shell:runtime', (next) => {
        snapshot = next;
        renderFace();
    }, { replay: true });
    renderFace();
}

export function unmount() {
    if (off) {
        off();
        off = undefined;
    }
    root = undefined;
    snapshot = null;
}

export function detail() {
    if (!snapshot) {
        return { body: 'The shell has not reported yet.' };
    }
    const c = counts(snapshot.tiles);
    return {
        body: c.live + ' live, ' + c.failed + ' failed, ' + c.loading + ' loading, ' + c.disabled + ' disabled.',
        node: buildDetail()
    };
}
