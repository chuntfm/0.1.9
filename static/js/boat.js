(function () {
    "use strict";

    // Boat night: the page rocks like a boat along boat.sway and glows warmly
    // along boat.glow, each a list of time points interpolated linearly.
    // Checks the clock once a minute while active; idle outside the window.

    var cfg = (window.SITE_CONFIG || {}).boat;
    if (!cfg) return;

    // Parse a list of {at, <key>} points into [{at, value}], or null if unusable
    function curve(list, key) {
        if (!list || list.length < 2) return null;
        var points = [];
        for (var i = 0; i < list.length; i++) {
            var at = Date.parse(list[i].at);
            var value = Number(list[i][key]);
            if (isNaN(at) || isNaN(value) || value < 0) return null;
            if (i > 0 && at <= points[i - 1].at) return null;
            points.push({ at: at, value: value });
        }
        return points;
    }

    // Value at time t, linear between the surrounding points, held flat beyond the ends
    function valueAt(points, t) {
        if (!points) return 0;
        if (t <= points[0].at) return points[0].value;
        for (var i = 1; i < points.length; i++) {
            var a = points[i - 1], b = points[i];
            if (t < b.at) return a.value + (b.value - a.value) * (t - a.at) / (b.at - a.at);
        }
        return points[points.length - 1].value;
    }

    var sway = curve(cfg.sway, "deg");
    var glow = curve(cfg.glow, "level");
    if (!sway) return;
    var start = sway[0].at;
    var end = sway[sway.length - 1].at;
    if (glow) {
        start = Math.min(start, glow[0].at);
        end = Math.max(end, glow[glow.length - 1].at);
    }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var root = document.documentElement;
    var deck = document.getElementById("deck");
    if (!deck) return;

    var MINUTE = 60000;
    var HOUR = 3600000;
    var active = false;

    // Rock around the centre of the viewport, wherever the page is scrolled to
    function updateOrigin() {
        var y = window.pageYOffset + window.innerHeight / 2 - deck.offsetTop;
        deck.style.transformOrigin = "50% " + Math.round(y) + "px";
    }

    function setState(deg, level) {
        root.style.setProperty("--boat-tilt", deg.toFixed(3) + "deg");
        root.style.setProperty("--boat-heave", (deg * 3).toFixed(2) + "px");
        root.style.setProperty("--boat-glow", level.toFixed(3));
        if (level > 0) {
            root.classList.add("boat-glow");
        } else {
            root.classList.remove("boat-glow");
        }
    }

    function rock(deg, level) {
        setState(deg, level);
        if (active) return;
        active = true;
        updateOrigin();
        window.addEventListener("scroll", updateOrigin);
        window.addEventListener("resize", updateOrigin);
        root.classList.add("boat");
    }

    function dock() {
        if (!active) return;
        active = false;
        root.classList.remove("boat");
        root.classList.remove("boat-glow");
        root.style.removeProperty("--boat-tilt");
        root.style.removeProperty("--boat-heave");
        root.style.removeProperty("--boat-glow");
        deck.style.transformOrigin = "";
        window.removeEventListener("scroll", updateOrigin);
        window.removeEventListener("resize", updateOrigin);
    }

    function tick() {
        var now = Date.now();
        if (now < start) {
            setTimeout(tick, Math.min(start - now, HOUR));
        } else if (now < end) {
            rock(valueAt(sway, now), valueAt(glow, now));
            setTimeout(tick, Math.min(end - now, MINUTE));
        } else {
            dock();
        }
    }

    // Preview: __rockBoat(1.5, 0.8) rocks at 1.5 degrees with the glow at 80%, __rockBoat() stops
    window.__rockBoat = function (deg, level) {
        if (deg === undefined) { dock(); } else { rock(Number(deg) || 0, Number(level) || 0); }
    };

    tick();
})();
