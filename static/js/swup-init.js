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
            if (typeof window.__initArchive === "function") {
                window.__initArchive();
            }

            // Update document title with day count
            if (typeof window.__updateDocTitle === "function") {
                window.__updateDocTitle();
            }

            // Update tz-row visibility based on current page
            updateTzRowVisibility();

            // Update collapsed nav link for current page
            updateCollapsedNav();

            // Focus management for accessibility
            var swupEl = document.getElementById("swup-content");
            if (swupEl) {
                swupEl.focus({ preventScroll: true });
            }

            // Announce page change to screen readers
            var announcer = document.getElementById("page-announce");
            if (announcer) {
                announcer.textContent = document.title;
            }

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

    function updateCollapsedNav() {
        var swupContent = document.getElementById("swup-content");
        if (!swupContent) return;
        var page = swupContent.getAttribute("data-page");
        var currentSlug = page === "home" ? "" : page;
        var pages = (window.SITE_CONFIG || {}).pages || [];
        var currentPage = null;
        for (var i = 0; i < pages.length; i++) {
            if (pages[i].slug === currentSlug) { currentPage = pages[i]; break; }
        }
        if (!currentPage || currentPage.nav_default === undefined) return;
        var defaultPage = null;
        for (var j = 0; j < pages.length; j++) {
            if (pages[j].slug === currentPage.nav_default) { defaultPage = pages[j]; break; }
        }
        if (!defaultPage) return;
        var collapsedLink = document.querySelector("#links-collapsed .nav-link");
        if (collapsedLink) {
            collapsedLink.href = "/" + (defaultPage.slug ? defaultPage.slug + "/" : "");
            collapsedLink.textContent = defaultPage.nav_name.toUpperCase();
        }
    }

    function updateTzRowVisibility() {
        var swupContent = document.getElementById("swup-content");
        var tzRow = document.getElementById("tz-row");
        if (!swupContent || !tzRow) return;
        var isHome = swupContent.getAttribute("data-page") === "home";
        tzRow.style.display = isHome ? "" : "none";
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
