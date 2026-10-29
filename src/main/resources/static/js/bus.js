// A tiny publish/subscribe bus for cross-tile messages, built on CustomEvent.
// The shell owns one instance and hands it to every tile as ctx.bus, so tiles
// never import each other. Name events "<tile-id>:<what-happened>".
//
//   const off = bus.on('tasks:changed', (detail) => {...}, { replay: true });
//   bus.emit('tasks:changed', { remaining: 4 });
//   off();   // call from unmount()
//
// Tiles load concurrently, so a subscriber can start after the publisher has
// already emitted. { replay: true } delivers the most recent event, if any.

export function createBus() {
    const target = new EventTarget();
    const last = new Map();

    function check(type) {
        if (typeof type !== 'string' || type === '') {
            throw new TypeError('Bus event type must be a non-empty string');
        }
    }

    return {
        emit(type, detail) {
            check(type);
            last.set(type, detail);
            target.dispatchEvent(new CustomEvent(type, { detail }));
        },

        on(type, handler, options) {
            check(type);
            const listener = (event) => handler(event.detail);
            target.addEventListener(type, listener);
            if (options && options.replay && last.has(type)) {
                // Same isolation as a live event: a throwing subscriber is reported, not rethrown.
                try {
                    handler(last.get(type));
                } catch (error) {
                    console.error('Bus handler for "' + type + '" failed:', error);
                }
            }
            return () => target.removeEventListener(type, listener);
        }
    };
}
