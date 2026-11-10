(function () {
    "use strict";

    var startDate = new Date(window.SITE_CONFIG.counter.start_date + "T00:00:00Z");
    var counterEl = document.getElementById("day-counter");

    function getDayCount() {
        var now = new Date();
        var utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        var utcStart = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
        return Math.floor((utcNow - utcStart) / (1000 * 60 * 60 * 24));
    }

    // Set document title immediately
    function getBaseTitle() {
        return window.SITE_CONFIG.site.title + ": " + getDayCount() + " days of chunt";
    }

    function updateDocTitle() {
        var pageEl = document.getElementById("swup-content");
        var page = pageEl ? pageEl.getAttribute("data-page") : "home";
        if (page && page !== "home") {
            document.title = page.charAt(0).toUpperCase() + page.slice(1) + " - " + getBaseTitle();
        } else {
            document.title = getBaseTitle();
        }
    }

    window.__updateDocTitle = updateDocTitle;
    updateDocTitle();

    function updateCounter(bpm) {
        if (!counterEl) return;

        // On 404 page, show chunt404.org instead of day count
        var pageEl = document.getElementById("swup-content");
        var is404 = pageEl && pageEl.getAttribute("data-page") === "404";

        counterEl.innerHTML = "";
        var link = document.createElement("a");
        link.className = "counter-link";

        if (is404) {
            link.href = "https://chunt404.org";
            link.textContent = "chunt404.org";
        } else if (bpm) {
            link.href = "https://chunt" + bpm + ".org";
            link.textContent = "chunt" + bpm + ".org";
        } else {
            var days = getDayCount();
            var domain = "chunt" + days + ".org";
            link.href = "https://" + domain;
            link.textContent = domain;
        }

        counterEl.appendChild(link);
    }

    window.__initCounter = function () {
        updateCounter();
    };

    updateCounter();

    // BPM tap tempo
    var titleCell = document.getElementById("header-title");
    if (!titleCell) return;

    var taps = [];
    var REQUIRED_TAPS = 4;
    var TAP_TIMEOUT = 2000;

    // Least-squares line through the tap times: beat length (ms) and time of the first beat
    function fitBeat(times) {
        var n = times.length;
        var meanIndex = (n - 1) / 2;
        var meanTime = 0;
        var i;
        for (i = 0; i < n; i++) meanTime += times[i];
        meanTime /= n;
        var sxy = 0;
        var sxx = 0;
        for (i = 0; i < n; i++) {
            sxy += (i - meanIndex) * (times[i] - meanTime);
            sxx += (i - meanIndex) * (i - meanIndex);
        }
        var period = sxy / sxx;
        return { period: period, start: meanTime - period * meanIndex };
    }

    // One repeating animation, one beat long, placed on the fitted beat grid
    function startPulse(beat) {
        titleCell.style.setProperty("--beat-ms", beat.period + "ms");
        titleCell.classList.add("bpm-beat");
        if (!titleCell.getAnimations) return;
        var anims = titleCell.getAnimations();
        for (var i = 0; i < anims.length; i++) {
            if (anims[i].animationName === "bpm-pulse") anims[i].startTime = beat.start;
        }
    }

    function stopPulse() {
        titleCell.classList.remove("bpm-beat");
        titleCell.style.removeProperty("--beat-ms");
    }

    // Taps count on press, not on release
    titleCell.addEventListener("pointerdown", function (e) {
        if (e.button !== 0 || e.target.tagName === "A") return;

        var now = performance.now();

        // Reset if too long since last tap
        if (taps.length > 0 && now - taps[taps.length - 1] > TAP_TIMEOUT) {
            taps = [];
            stopPulse();
            updateCounter();
        }

        taps.push(now);

        if (taps.length >= REQUIRED_TAPS) {
            var beat = fitBeat(taps);
            updateCounter(Math.round(60000 / beat.period));
            startPulse(beat);
        }
    });
})();
