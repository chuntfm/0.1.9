(function () {
    "use strict";

    // Dynamically load swup and its head plugin from CDN
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function initSwup() {
        if (typeof Swup === "undefined") return;

        var plugins = [];
        if (typeof SwupHeadPlugin !== "undefined") {
            plugins.push(new SwupHeadPlugin());
        }

        var swup = new Swup({
            containers: ["#swup-content"],
            plugins: plugins,
            animationSelector: '[class*="transition-"]',
        });

        // Re-init schedule content after each page swap
        swup.hooks.on("page:view", function () {
            if (typeof window.__initSchedule === "function") {
                window.__initSchedule();
            }

            // Update tz-row visibility based on current page
            updateTzRowVisibility();

            // GoatCounter tracking on swap
            if (typeof window.goatcounter !== "undefined" && window.goatcounter.count) {
                window.goatcounter.count({
                    path: window.location.pathname,
                });
            }
        });

        // Set initial tz-row visibility
        updateTzRowVisibility();
    }

    function updateTzRowVisibility() {
        var swupContent = document.getElementById("swup-content");
        var tzRow = document.getElementById("tz-row");
        if (!swupContent || !tzRow) return;
        var page = swupContent.getAttribute("data-page");
        tzRow.style.display = page === "home" ? "" : "none";
    }

    // Load swup CDN scripts then initialize
    loadScript("https://unpkg.com/swup@4")
        .then(function () {
            return loadScript("https://unpkg.com/@swup/head-plugin@2");
        })
        .then(initSwup)
        .catch(function () {
            // swup failed to load — site works fine without it (full page navigations)
        });
})();
