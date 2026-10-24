(function () {
    "use strict";

    // Boat night: the page rocks like a boat along boat.sway and glows warmly
    // along boat.glow, each a list of time points interpolated linearly.
    // Checks the clock once a minute while active; idle outside the window.
    //
    // The roll is written as a plain transform on #deck every animation frame.
    // As a CSS keyframe animation on #deck (a layer as tall as the document),
    // iOS browsers (all WebKit) killed the page while the boat was on.
    //
    // Test on a device: ?boat=1.5,0.8 rocks at 1.5 degrees with the glow at 80%
    // regardless of the schedule; ?boat=off disables the boat for that load.
    //
    // Crash guard: a sessionStorage flag is set while the boat runs in a visible
    // page and cleared on pagehide or when hidden. A load that finds it still set
    // follows a page that died with the boat running, so the boat stays off for
    // the rest of the browser session (a new tab resets it).

    var cfg = (window.SITE_CONFIG || {}).boat;
    if (!cfg) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var root = document.documentElement;
    var deck = document.getElementById("deck");
    var mini = document.getElementById("mini-player");
    if (!deck) return;

    // --- Crash guard ---

    var ARMED = "chunt-boat-armed";
    var OFF = "chunt-boat-off";

    // Run fn with sessionStorage; null if storage is unavailable or throws
    function session(fn) {
        try {
            return fn(window.sessionStorage);
        } catch (e) {
            return null;
        }
    }

    var tripped = session(function (s) {
        if (s.getItem(ARMED)) {
            s.removeItem(ARMED);
            s.setItem(OFF, "1");
        }
        return s.getItem(OFF) === "1";
    });
    if (tripped) return;

    // --- Preview from the query string ---

    var preview = null;
    var arg = null;
    try {
        arg = new URLSearchParams(window.location.search).get("boat");
    } catch (e) {
        arg = null;
    }
    if (arg === "off") return;
    if (arg) {
        var parts = arg.split(",");
        var previewDeg = Number(parts[0]);
        var previewLevel = parts.length > 1 ? Number(parts[1]) : 0;
        if (!isNaN(previewDeg) && !isNaN(previewLevel)) {
            preview = {
                deg: Math.max(0, previewDeg),
                level: Math.min(1, Math.max(0, previewLevel))
            };
        }
    }

    // --- Schedule ---

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
    if (!sway && !preview) return;

    // --- Motion ---

    var ROLL_MS = 7000;   // one full roll, port to starboard and back
    var HEAVE_MS = 4600;  // one full heave, up and down
    var HEAVE_PX_PER_DEG = 3;
    var TWO_PI = 2 * Math.PI;
    var MINUTE = 60000;
    var HOUR = 3600000;

    var amp = 0;          // roll amplitude in degrees
    var rolling = false;
    var glowing = false;
    var raf = 0;
    var deckTop = 0;
    var viewHeight = 0;

    function measure() {
        deckTop = deck.offsetTop;
        viewHeight = window.innerHeight;
    }

    function frame(t) {
        raf = window.requestAnimationFrame(frame);
        var tilt = -amp * Math.cos(TWO_PI * t / ROLL_MS);
        var heave = -HEAVE_PX_PER_DEG * amp * Math.cos(TWO_PI * t / HEAVE_MS);
        // Rock around the centre of the viewport, wherever the page is scrolled to
        var originY = window.pageYOffset + viewHeight / 2 - deckTop;
        deck.style.transformOrigin = "50% " + originY.toFixed(1) + "px";
        deck.style.transform = "translateY(" + heave.toFixed(2) + "px) rotate(" + tilt.toFixed(3) + "deg)";
        if (mini) {
            // Individual properties, so the mini player's own show/hide transform stays intact
            mini.style.translate = "0 " + heave.toFixed(2) + "px";
            mini.style.rotate = tilt.toFixed(3) + "deg";
        }
    }

    function startRoll() {
        if (rolling) return;
        rolling = true;
        measure();
        window.addEventListener("resize", measure);
        root.classList.add("boat");
        raf = window.requestAnimationFrame(frame);
    }

    function stopRoll() {
        if (!rolling) return;
        rolling = false;
        window.cancelAnimationFrame(raf);
        window.removeEventListener("resize", measure);
        root.classList.remove("boat");
        deck.style.transform = "";
        deck.style.transformOrigin = "";
        if (mini) {
            mini.style.translate = "";
            mini.style.rotate = "";
        }
    }

    function setGlow(level) {
        glowing = level > 0;
        if (glowing) {
            root.style.setProperty("--boat-glow", level.toFixed(3));
            root.classList.add("boat-glow");
        } else {
            root.classList.remove("boat-glow");
            root.style.removeProperty("--boat-glow");
        }
    }

    // Armed while anything runs in a visible page
    function syncGuard() {
        var on = (rolling || glowing) && document.visibilityState !== "hidden";
        session(function (s) {
            if (on) {
                s.setItem(ARMED, "1");
            } else {
                s.removeItem(ARMED);
            }
        });
    }

    function apply(deg, level) {
        amp = deg;
        setGlow(level);
        if (deg > 0) {
            startRoll();
        } else {
            stopRoll();
        }
        syncGuard();
    }

    document.addEventListener("visibilitychange", syncGuard);
    window.addEventListener("pageshow", syncGuard);
    window.addEventListener("pagehide", function () {
        session(function (s) { s.removeItem(ARMED); });
    });

    function tick() {
        var now = Date.now();
        var start = sway[0].at;
        var end = sway[sway.length - 1].at;
        if (glow) {
            start = Math.min(start, glow[0].at);
            end = Math.max(end, glow[glow.length - 1].at);
        }
        if (now < start) {
            setTimeout(tick, Math.min(start - now, HOUR));
        } else if (now < end) {
            apply(valueAt(sway, now), valueAt(glow, now));
            setTimeout(tick, Math.min(end - now, MINUTE));
        } else {
            apply(0, 0);
        }
    }

    // Console preview: __rockBoat(1.5, 0.8) rocks at 1.5 degrees with the glow at 80%, __rockBoat() stops
    window.__rockBoat = function (deg, level) {
        if (deg === undefined) {
            apply(0, 0);
        } else {
            apply(Math.max(0, Number(deg) || 0), Math.min(1, Math.max(0, Number(level) || 0)));
        }
    };

    if (preview) {
        apply(preview.deg, preview.level);
    } else {
        tick();
    }
})();
