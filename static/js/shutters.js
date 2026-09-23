(function () {
    "use strict";

    // Panorama Bar shutters: once an hour the background gives way to sunlight.
    // A single armed timeout; nothing runs between openings.

    var cfg = (window.SITE_CONFIG || {}).shutters;
    if (!cfg || !cfg.enabled) return;

    var minute = parseInt(cfg.minute, 10);
    var duration = Number(cfg.duration);
    if (isNaN(minute) || minute < 0 || minute > 59) return;
    if (!(duration > 0)) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var HOUR = 3600000;
    var durationMs = duration * 1000;
    var root = document.documentElement;
    var closeTimer = null;
    var target = 0;

    function open(ms) {
        if (closeTimer) clearTimeout(closeTimer);
        root.classList.add("shutters-open");
        closeTimer = setTimeout(function () {
            root.classList.remove("shutters-open");
            closeTimer = null;
        }, ms);
    }

    // Next occurrence of :minute UTC strictly after `from` (ms timestamp)
    function nextTarget(from) {
        var next = new Date(from);
        next.setUTCMinutes(minute, 0, 0);
        while (next.getTime() <= from) next.setTime(next.getTime() + HOUR);
        return next.getTime();
    }

    function arm() {
        target = nextTarget(Math.max(Date.now(), target));
        setTimeout(fire, target - Date.now());
    }

    function fire() {
        var late = Date.now() - target;
        // Skip if the tab is hidden or the timer woke up too late (throttling, sleep)
        if (!document.hidden && late < durationMs) {
            open(durationMs - late);
        }
        arm();
    }

    window.__openShutters = function () { open(durationMs); };

    arm();
})();
