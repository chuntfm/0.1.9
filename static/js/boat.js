(function () {
    "use strict";

    // Boat night: between boat.start and boat.end the page rocks like a boat,
    // the sway growing from nothing to boat.tilt degrees over the window.
    // Checks the clock once a minute while rocking; idle outside the window.

    var cfg = (window.SITE_CONFIG || {}).boat;
    if (!cfg || !cfg.start || !cfg.end) return;

    var start = Date.parse(cfg.start);
    var end = Date.parse(cfg.end);
    var tilt = Number(cfg.tilt);
    if (isNaN(start) || isNaN(end) || end <= start || !(tilt > 0)) return;
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

    function setStrength(progress) {
        var deg = tilt * progress;
        root.style.setProperty("--boat-tilt", deg.toFixed(3) + "deg");
        root.style.setProperty("--boat-heave", (deg * 3).toFixed(2) + "px");
    }

    function rock(progress) {
        setStrength(progress);
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
        root.style.removeProperty("--boat-tilt");
        root.style.removeProperty("--boat-heave");
        deck.style.transformOrigin = "";
        window.removeEventListener("scroll", updateOrigin);
        window.removeEventListener("resize", updateOrigin);
    }

    function tick() {
        var now = Date.now();
        if (now < start) {
            setTimeout(tick, Math.min(start - now, HOUR));
        } else if (now < end) {
            rock((now - start) / (end - start));
            setTimeout(tick, Math.min(end - now, MINUTE));
        } else {
            dock();
        }
    }

    // Preview: __rockBoat(0.5) rocks at half strength, __rockBoat() stops
    window.__rockBoat = function (progress) {
        if (progress === undefined) { dock(); } else { rock(progress); }
    };

    tick();
})();
