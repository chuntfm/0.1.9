(function () {
    "use strict";

    // --- Links expand/collapse ---

    var linksToggle = document.getElementById("links-toggle");
    var linksCollapse = document.getElementById("links-collapse");
    var linksCollapsed = document.getElementById("links-collapsed");
    var linksExpanded = document.getElementById("links-expanded");

    function expandLinks() {
        linksCollapsed.hidden = true;
        linksExpanded.hidden = false;
        linksToggle.setAttribute("aria-expanded", "true");
    }

    function collapseLinks() {
        linksExpanded.hidden = true;
        linksCollapsed.hidden = false;
        linksToggle.setAttribute("aria-expanded", "false");
    }

    if (linksToggle) linksToggle.addEventListener("click", expandLinks);
    if (linksCollapse) linksCollapse.addEventListener("click", collapseLinks);

    // Collapse drawer when an internal nav link is clicked
    if (linksExpanded) {
        var internalLinks = linksExpanded.querySelectorAll('.nav-link:not([target="_blank"])');
        internalLinks.forEach(function (link) {
            link.addEventListener("click", collapseLinks);
        });
    }

    // --- Email obfuscation assembly ---

    var emailEl = document.getElementById("obfuscated-email");
    if (emailEl) {
        var u = emailEl.getAttribute("data-u");
        var d = emailEl.getAttribute("data-d");
        if (u && d) {
            emailEl.textContent = u + "@" + d;
        }
    }

    // --- Easter eggs via tz-toggle ---

    var tzToggle = document.getElementById("tz-toggle");
    if (tzToggle) {
        var toggleTimestamps = [];

        tzToggle.addEventListener("change", function () {
            var now = Date.now();
            toggleTimestamps.push(now);

            // Keep only recent timestamps (within 3s)
            toggleTimestamps = toggleTimestamps.filter(function (t) {
                return now - t < 3000;
            });

            // Dark mode: 3 toggles within 2s
            if (toggleTimestamps.length >= 3) {
                var threeAgo = toggleTimestamps[toggleTimestamps.length - 3];
                if (now - threeAgo < 2000) {
                    toggleTimestamps = [];
                    var current = document.documentElement.getAttribute("data-theme");
                    var isDark = current === "dark" ||
                        (!current && window.matchMedia("(prefers-color-scheme: dark)").matches);
                    var newTheme = isDark ? "light" : "dark";
                    document.documentElement.setAttribute("data-theme", newTheme);
                    localStorage.setItem("themeMode", newTheme);
                    return;
                }
            }

            // Jukebox: 2 toggles with ~2s delay (1.7-2.3s apart)
            if (toggleTimestamps.length >= 2) {
                var prev = toggleTimestamps[toggleTimestamps.length - 2];
                var gap = now - prev;
                if (gap >= 1700 && gap <= 2300) {
                    toggleTimestamps = [];
                    var isJukebox = document.getElementById("site-title").classList.contains("jukebox");
                    window.switchChannel(isJukebox ? 1 : 2);
                    return;
                }
            }
        });
    }

    // --- Keyboard shortcuts for channel switching ---

    document.addEventListener("keydown", function (e) {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        if (e.key === "2") {
            window.switchChannel(2);
        } else if (e.key === "1") {
            window.switchChannel(1);
        }
    });
})();
