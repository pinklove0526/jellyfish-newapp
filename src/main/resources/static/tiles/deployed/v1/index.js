// Deployed apps: what the manifest says is deployed (each tile, its version and
// module path) plus the build info the server reports (app version, git SHA,
// build time). Both come from the shell's "shell:runtime" snapshot.
let root;
let off;
let snapshot = null;

function shortSha(sha) {
    return /^[0-9a-f]{40}$/.test(sha) ? sha.slice(0, 7) : sha;
}

function builtAt(build) {
    if (!build || !build.builtAt) {
        return 'build time unknown';
    }
    return 'built ' + new Date(build.builtAt).toLocaleString();
}

function render() {
    const build = snapshot && snapshot.build;
    root.querySelector('[data-role="app"]').textContent = build ? 'v' + build.version : 'waiting for the shell';
    root.querySelector('[data-role="sha"]').textContent = build ? shortSha(build.gitSha) : '–';
    root.querySelector('[data-role="built"]').textContent = build ? builtAt(build) : '';
}

function cell(tag, text, align) {
    const el = document.createElement(tag);
    el.textContent = text;
    el.style.cssText = 'padding:3px 8px 3px 0;text-align:' + (align || 'left') + ';font-weight:' + (tag === 'th' ? '600' : '300');
    return el;
}

function table(rows, head) {
    const t = document.createElement('table');
    t.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;margin-top:8px';
    if (head) {
        const tr = document.createElement('tr');
        head.forEach((h) => tr.appendChild(cell('th', h)));
        t.appendChild(tr);
    }
    rows.forEach((row) => {
        const tr = document.createElement('tr');
        row.forEach((value) => tr.appendChild(cell('td', value)));
        t.appendChild(tr);
    });
    return t;
}

function buildDetail() {
    const wrap = document.createElement('div');
    const build = snapshot.build;
    if (build) {
        wrap.appendChild(table([
            ['Application', build.app + ' v' + build.version],
            ['Commit', build.gitSha],
            ['Built', build.builtAt ? new Date(build.builtAt).toLocaleString() + ' (' + build.builtAt + ')' : 'unknown']
        ]));
    }
    wrap.appendChild(table(
        snapshot.tiles.map((tile) => [tile.title, 'v' + tile.version, tile.status, tile.moduleUrl]),
        ['Tile', 'Version', 'Status', 'Module']
    ));
    return wrap;
}

export function mount(el, ctx) {
    root = el;
    root.innerHTML = `
        <div style="position:absolute;left:12px;top:12px;right:12px">
            <div class="sub" data-role="app">&nbsp;</div>
            <div class="big" data-role="sha" style="font-size:40px;margin-top:8px">–</div>
            <div class="sub" data-role="built" style="font-size:13px">&nbsp;</div>
        </div>
        <span class="label">Deployed</span>`;
    off = ctx.bus.on('shell:runtime', (next) => {
        snapshot = next;
        render();
    }, { replay: true });
    render();
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
    if (!snapshot || snapshot.manifest.status !== 'live') {
        return { body: 'The manifest has not loaded.' };
    }
    const live = snapshot.tiles.filter((tile) => tile.status === 'live').length;
    return {
        body: live + ' of ' + snapshot.tiles.length + ' tiles are live.',
        node: buildDetail()
    };
}
