(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };

    var state = {
        mail: 3,
        tasks: 5,
        photoIndex: 0,
        trackIndex: -1
    };

    var photos = ['Summer 2026 · 48 photos', 'Coastline · 12 photos', 'Family · 230 photos', 'Screenshots · 17 photos'];
    var tracks = ['Ocean Drift · Tidal', 'Neon Rain · Static Bloom', 'Blue Hour · Coral Lane', 'Undertow · The Medusae'];
    var weather = [
        { temp: 18, desc: 'Partly cloudy' },
        { temp: 21, desc: 'Sunny' },
        { temp: 16, desc: 'Light rain' },
        { temp: 19, desc: 'Breezy' }
    ];

    function setStatus(message) {
        $('status-message').textContent = message;
    }

    // Fade the element out, swap its text, fade back in: the "live tile" flip.
    function flip(el, text) {
        el.classList.add('flip');
        setTimeout(function () {
            el.textContent = text;
            el.classList.remove('flip');
        }, 300);
    }

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    // --- Live tiles ---------------------------------------------------------

    function updateClock() {
        var now = new Date();
        $('clock-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        $('clock-date').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
        $('cal-day').textContent = now.getDate();
        $('cal-weekday').textContent = now.toLocaleDateString([], { weekday: 'long' });
        $('status-time').textContent = now.toLocaleTimeString();
    }

    function updateServer() {
        var latency = 20 + Math.floor(Math.random() * 180);
        var slow = latency > 150;
        $('server-state').textContent = slow ? 'Degraded' : 'Online';
        $('server-dot').classList.toggle('warn', slow);
        flip($('server-latency'), latency + ' ms');
    }

    function updateWeather() {
        var w = pick(weather);
        flip($('weather-temp'), w.temp + '°');
        $('weather-desc').textContent = w.desc;
    }

    function rotatePhotos() {
        state.photoIndex = (state.photoIndex + 1) % photos.length;
        flip($('photos-caption'), photos[state.photoIndex]);
    }

    function maybeNewMail() {
        if (Math.random() < 0.4) {
            state.mail += 1;
            renderCounts();
            setStatus('New message received');
        }
    }

    function renderCounts() {
        $('mail-count').textContent = state.mail;
        $('task-count').textContent = state.tasks;
    }

    // --- Detail panel -------------------------------------------------------

    var modal = $('tile-modal');
    var panel = $('modal-panel');
    var lastFocused = null;

    function colorClassOf(el) {
        for (var i = 0; i < el.classList.length; i++) {
            if (el.classList[i].indexOf('w3-win8-') === 0) {
                return el.classList[i];
            }
        }
        return 'w3-win8-cobalt';
    }

    function actionButton(label, onClick) {
        var btn = document.createElement('button');
        btn.className = 'w3-button w3-border w3-border-white w3-margin-right';
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        return btn;
    }

    var details = {
        clock: function () {
            return { body: 'Local time zone: ' + Intl.DateTimeFormat().resolvedOptions().timeZone + '.' };
        },
        mail: function () {
            return {
                body: 'You have ' + state.mail + ' unread message' + (state.mail === 1 ? '' : 's') + '.',
                actions: [actionButton('Mark all read', function () {
                    state.mail = 0;
                    renderCounts();
                    setStatus('All mail marked as read');
                    closeModal();
                })]
            };
        },
        calendar: function () {
            return { body: 'No events scheduled for ' + new Date().toLocaleDateString() + '.' };
        },
        server: function () {
            return {
                body: 'Status: ' + $('server-state').textContent + ', latency ' + $('server-latency').textContent + '.',
                actions: [actionButton('Check now', function () {
                    updateServer();
                    setStatus('Server status refreshed');
                    closeModal();
                })]
            };
        },
        photos: function () {
            return { body: 'Showing album: ' + photos[state.photoIndex] + '.' };
        },
        tasks: function () {
            return {
                body: state.tasks > 0 ? state.tasks + ' task' + (state.tasks === 1 ? '' : 's') + ' left today.' : 'All caught up.',
                actions: state.tasks > 0 ? [actionButton('Complete one', function () {
                    state.tasks -= 1;
                    renderCounts();
                    setStatus('Task completed — ' + state.tasks + ' left');
                    closeModal();
                })] : []
            };
        },
        weather: function () {
            return { body: 'Currently ' + $('weather-temp').textContent + ' and ' + $('weather-desc').textContent.toLowerCase() + '.' };
        },
        music: function () {
            return {
                body: state.trackIndex < 0 ? 'Nothing playing.' : 'Now playing: ' + tracks[state.trackIndex] + '.',
                actions: [actionButton(state.trackIndex < 0 ? 'Play' : 'Next track', function () {
                    state.trackIndex = (state.trackIndex + 1) % tracks.length;
                    flip($('music-track'), tracks[state.trackIndex]);
                    setStatus('Playing ' + tracks[state.trackIndex]);
                    closeModal();
                })]
            };
        },
        store: function () {
            return { body: 'All your apps are up to date.' };
        },
        settings: function () {
            return { body: 'Live tiles refresh every few seconds. Click a tile to open its details.' };
        }
    };

    function openModal(tile) {
        var key = tile.getAttribute('data-tile');
        var info = (details[key] || function () { return { body: '' }; })();

        panel.className = 'w3-modal-content w3-animate-right ' + colorClassOf(tile);
        $('modal-title').textContent = tile.getAttribute('data-title');
        $('modal-body').textContent = info.body;

        var actions = $('modal-actions');
        actions.innerHTML = '';
        (info.actions || []).forEach(function (btn) { actions.appendChild(btn); });

        lastFocused = tile;
        modal.style.display = 'block';
        $('modal-close').focus();
        setStatus('Opened ' + tile.getAttribute('data-title'));
    }

    function closeModal() {
        modal.style.display = 'none';
        if (lastFocused) {
            lastFocused.focus();
        }
    }

    // --- Wiring -------------------------------------------------------------

    document.querySelectorAll('.tile').forEach(function (tile) {
        tile.addEventListener('pointerdown', function () { tile.classList.add('pressed'); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (evt) {
            tile.addEventListener(evt, function () { tile.classList.remove('pressed'); });
        });
        tile.addEventListener('click', function () { openModal(tile); });
    });

    $('modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });

    updateClock();
    updateServer();
    updateWeather();
    renderCounts();
    $('photos-caption').textContent = photos[0];

    setInterval(updateClock, 1000);
    setInterval(updateServer, 5000);
    setInterval(updateWeather, 15000);
    setInterval(rotatePhotos, 4000);
    setInterval(maybeNewMail, 10000);
})();
