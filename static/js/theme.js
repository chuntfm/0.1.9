(function () {
    "use strict";

    // --- Theme color meta (matches iOS/Android status bar to bg) ---

    function updateThemeColor(theme) {
        var config = window.SITE_CONFIG;
        var color = theme === "dark" ? config.theme.dark.bg : config.theme.light.bg;
        var metas = document.querySelectorAll('meta[name="theme-color"]');
        metas.forEach(function (m) { m.setAttribute("content", color); });
    }

    // --- Follow system theme changes (clear manual override) ---

    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
            localStorage.removeItem("themeMode");
            document.documentElement.removeAttribute("data-theme");
            updateThemeColor(this.matches ? "dark" : "light");
        });
    }

    // iOS only applies :active during a press when a touch listener exists
    document.addEventListener("touchstart", function () {}, { passive: true });

    // --- Links expand/collapse ---

    var linksToggle = document.getElementById("links-toggle");
    var linksQuick = document.getElementById("links-quick");
    var linksExpanded = document.getElementById("links-expanded");
    var recordRow = document.getElementById("record-row");
    var recordFold = document.getElementById("record-fold");

    function setLinksOpen(open) {
        recordRow.classList.toggle("open", open);
        document.documentElement.classList.toggle("record-open", open);
        recordFold.inert = !open;
        linksToggle.setAttribute("aria-expanded", open ? "true" : "false");
        linksToggle.setAttribute("aria-label", open ? "Close menu" : "More links");
        if (window.__setRecordOpen) window.__setRecordOpen(open);
    }

    // On phones, scroll the record into view in step with the unfold,
    // stopping before the drop-down would go under the mini player.
    // Ends early if the visitor scrolls or the menu closes.
    function slideRecordIntoView() {
        if (!window.matchMedia("(max-width: 768px)").matches) return;
        var panel = document.getElementById("record-panel");
        var cell = document.getElementById("links-cell").getBoundingClientRect();
        var miniHeight = document.getElementById("mini-player").offsetHeight;
        var distance = Math.min(cell.bottom + panel.offsetHeight - window.innerHeight, cell.top - miniHeight);
        if (distance <= 0) return;
        var startY = window.scrollY;
        var lastY = startY;

        function follow() {
            if (window.scrollY !== lastY || !recordRow.classList.contains("open")) return;
            // +1 absorbs pixel rounding
            var progress = Math.min((recordFold.offsetHeight + 1) / panel.offsetHeight, 1);
            window.scrollTo(0, startY + distance * progress);
            lastY = window.scrollY;
            if (progress < 1) requestAnimationFrame(follow);
        }
        follow();
    }

    linksToggle.addEventListener("click", function () {
        var open = !recordRow.classList.contains("open");
        setLinksOpen(open);
        if (open) slideRecordIntoView();
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && recordRow.classList.contains("open")) {
            setLinksOpen(false);
            linksToggle.focus();
        }
    });

    // Collapse the menu when an internal link is clicked (record words included)
    function collapseOnInternalLink(e) {
        var link = e.target.closest("a");
        if (link && link.getAttribute("target") !== "_blank") setLinksOpen(false);
    }

    linksExpanded.addEventListener("click", collapseOnInternalLink);
    if (linksQuick) linksQuick.addEventListener("click", collapseOnInternalLink);

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
                    updateThemeColor(newTheme);
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
