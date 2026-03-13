(function () {
    "use strict";

    // --- Links expand/collapse + rotation ---

    var linksToggle = document.getElementById("links-toggle");
    var linksCollapse = document.getElementById("links-collapse");
    var linksCollapsed = document.getElementById("links-collapsed");
    var linksExpanded = document.getElementById("links-expanded");
    var linksRotating = document.getElementById("links-rotating");

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

    // Build rotation: primary links + quotes
    var rotItems = [];
    if (linksExpanded) {
        var allLinkEls = linksExpanded.querySelectorAll(".nav-link[data-primary]");
        allLinkEls.forEach(function (el) {
            rotItems.push({ type: "link", name: el.textContent, url: el.href });
        });
    }
    (window.LINKS_QUOTES || []).forEach(function (q) {
        rotItems.push({ type: "quote", text: q });
    });

    var rotIdx = 0;

    function showRotItem(idx) {
        if (!linksRotating || rotItems.length === 0) return;
        var item = rotItems[idx];
        linksRotating.innerHTML = "";
        if (item.type === "link") {
            var a = document.createElement("a");
            a.href = item.url;
            a.target = "_blank";
            a.rel = "noopener";
            a.className = "nav-link nav-link-inline";
            a.textContent = item.name;
            linksRotating.appendChild(a);
        } else {
            var span = document.createElement("span");
            span.className = "links-quote";
            span.textContent = item.text;
            linksRotating.appendChild(span);
        }
    }

    function rotateItem() {
        if (rotItems.length <= 1) return;
        linksRotating.style.opacity = "0";
        setTimeout(function () {
            rotIdx = (rotIdx + 1) % rotItems.length;
            showRotItem(rotIdx);
            linksRotating.style.opacity = "1";
        }, 300);
    }

    if (rotItems.length > 0) {
        showRotItem(0);
        setInterval(rotateItem, 5000);
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
