const conditions = [
    { temp: 18, desc: 'Partly cloudy' },
    { temp: 21, desc: 'Sunny' },
    { temp: 16, desc: 'Light rain' },
    { temp: 19, desc: 'Breezy' }
];

let root;
let ctx;
let timer;
let current = conditions[0];

function update(animate) {
    current = conditions[Math.floor(Math.random() * conditions.length)];
    const temp = root.querySelector('[data-role="temp"]');
    if (animate) {
        ctx.flip(temp, current.temp + '°');
    } else {
        temp.textContent = current.temp + '°';
    }
    root.querySelector('[data-role="desc"]').textContent = current.desc;
}

export function mount(el, context) {
    root = el;
    ctx = context;
    root.innerHTML = `
        <div class="center">
            <div class="w3-center">
                <div class="big live" data-role="temp">--°</div>
                <div class="sub" data-role="desc">&nbsp;</div>
            </div>
        </div>
        <span class="label">Weather</span>`;
    update(false);
    timer = setInterval(() => update(true), 15000);
}

export function unmount() {
    clearInterval(timer);
    timer = undefined;
    root = undefined;
    ctx = undefined;
}

export function detail() {
    return { body: 'Currently ' + current.temp + '° and ' + current.desc.toLowerCase() + '.' };
}
