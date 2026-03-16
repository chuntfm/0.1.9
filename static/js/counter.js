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
        var days = getDayCount();
        var domain = "chunt" + days + ".org";
        if (!counterEl) return;

        counterEl.innerHTML = "";
        var link = document.createElement("a");
        link.href = "https://" + domain;
        link.className = "counter-link";

        if (bpm) {
            link.textContent = "chunt" + bpm + ".org";
            link.href = "https://chunt" + bpm + ".org";
        } else {
            link.textContent = domain;
        }

        counterEl.appendChild(link);
    }

    // On 404 page, show chunt404.org instead of day count
    var pageEl = document.getElementById("swup-content");
    var is404 = pageEl && pageEl.getAttribute("data-page") === "404";
    if (is404) {
        if (counterEl) {
            counterEl.innerHTML = "";
            var link = document.createElement("a");
            link.href = "https://chunt404.org";
            link.className = "counter-link";
            link.textContent = "chunt404.org";
            counterEl.appendChild(link);
        }
        return;
    }

    updateCounter();

    // BPM tap tempo
    var titleCell = document.getElementById("header-title");
    if (!titleCell) return;

    var taps = [];
    var beatInterval = null;
    var currentBpm = 0;
    var REQUIRED_TAPS = 4;
    var TAP_TIMEOUT = 2000;

    function triggerBeat(ms) {
        titleCell.style.setProperty("--beat-ms", ms + "ms");
        titleCell.classList.remove("bpm-beat");
        // Force reflow to restart animation
        void titleCell.offsetWidth;
        titleCell.classList.add("bpm-beat");
    }

    function startPulse(bpm) {
        stopPulse();
        var ms = 60000 / bpm;
        // Fire first beat immediately
        triggerBeat(ms);
        // Then keep firing on each beat
        beatInterval = setInterval(function () {
            triggerBeat(ms);
        }, ms);
    }

    function stopPulse() {
        if (beatInterval) {
            clearInterval(beatInterval);
            beatInterval = null;
        }
        titleCell.classList.remove("bpm-beat");
        titleCell.style.removeProperty("--beat-ms");
    }

    titleCell.addEventListener("click", function (e) {
        if (e.target.tagName === "A") return;

        var now = performance.now();

        // Reset if too long since last tap
        if (taps.length > 0 && now - taps[taps.length - 1] > TAP_TIMEOUT) {
            taps = [];
            stopPulse();
            currentBpm = 0;
            updateCounter();
        }

        taps.push(now);

        if (taps.length >= REQUIRED_TAPS) {
            var intervals = [];
            var start = taps.length - REQUIRED_TAPS;
            for (var i = start + 1; i < taps.length; i++) {
                intervals.push(taps[i] - taps[i - 1]);
            }
            var avgInterval = 0;
            for (var j = 0; j < intervals.length; j++) {
                avgInterval += intervals[j];
            }
            avgInterval /= intervals.length;

            currentBpm = Math.round(60000 / avgInterval);
            updateCounter(currentBpm);
            startPulse(currentBpm);
            taps = taps.slice(-REQUIRED_TAPS);
        }
    });
})();
