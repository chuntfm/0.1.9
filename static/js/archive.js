(function () {
    "use strict";

    var config = window.SITE_CONFIG;
    var cachedShows = null;
    var cachedTags = null;
    var activeTags = {};

    function fetchArchive() {
        var url = config.api.mixcloud_archive;
        if (!url) return;

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                data.sort(function (a, b) {
                    var dateA = (a.info && a.info.date) || "";
                    var dateB = (b.info && b.info.date) || "";
                    return dateB.localeCompare(dateA);
                });
                cachedShows = data;
                cachedTags = extractTags(data);
                render();
            })
            .catch(function () {
                var content = document.getElementById("archive-content");
                if (content) {
                    content.innerHTML = "";
                    var p = document.createElement("p");
                    p.className = "placeholder";
                    p.textContent = "failed to load archive";
                    content.appendChild(p);
                }
            });
    }

    function extractTags(shows) {
        var counts = {};
        shows.forEach(function (show) {
            var tags = show.info && show.info.tags ? show.info.tags : [];
            tags.forEach(function (tag) {
                if (!tag) return;
                var key = tag.toLowerCase();
                if (!counts[key]) counts[key] = { name: tag, count: 0 };
                counts[key].count++;
            });
        });

        var sorted = Object.keys(counts).map(function (k) { return counts[k]; });
        sorted.sort(function (a, b) { return b.count - a.count; });
        return sorted;
    }

    function getFilteredShows() {
        if (!cachedShows) return [];

        var searchEl = document.getElementById("archive-search");
        var query = searchEl ? searchEl.value.toLowerCase().trim() : "";

        var activeKeys = Object.keys(activeTags).filter(function (k) { return activeTags[k]; });

        return cachedShows.filter(function (show) {
            if (activeKeys.length > 0) {
                var showTags = (show.info && show.info.tags ? show.info.tags : []).map(function (t) { return t.toLowerCase(); });
                var allMatch = activeKeys.every(function (key) {
                    return showTags.indexOf(key) !== -1;
                });
                if (!allMatch) return false;
            }

            if (query) {
                var haystack = [
                    show.name || "",
                    show.info ? show.info.title || "" : "",
                    show.info ? show.info.date || "" : "",
                    (show.info && show.info.tags ? show.info.tags.join(" ") : ""),
                    (show.hosts ? show.hosts.map(function (h) { return h.name; }).join(" ") : "")
                ].join(" ").toLowerCase();

                if (haystack.indexOf(query) === -1) return false;
            }

            return true;
        });
    }

    function onTagClick(key) {
        activeTags[key] = !activeTags[key];
        render();
    }

    function onTagClear() {
        activeTags = {};
        render();
    }

    function renderTags() {
        var cell = document.getElementById("archive-label-cell");
        if (!cell || !cachedTags) return;

        // ensure a wrapper div exists inside the table-cell
        var container = document.getElementById("archive-tags");
        if (!container) {
            container = document.createElement("div");
            container.id = "archive-tags";
            cell.innerHTML = "";
            cell.appendChild(container);
        }

        container.innerHTML = "";

        var hasActive = Object.keys(activeTags).some(function (k) { return activeTags[k]; });

        if (hasActive) {
            var clearBtn = document.createElement("button");
            clearBtn.type = "button";
            clearBtn.className = "archive-tag archive-tag-clear";
            clearBtn.textContent = "CLEAR";
            clearBtn.onclick = onTagClear;
            container.appendChild(clearBtn);
        }

        var isMobile = window.innerWidth <= 768;
        var TAG_LIMIT = 15;
        var expanded = container.dataset.expanded === "true";
        var visibleTags = (!isMobile || expanded) ? cachedTags : cachedTags.slice(0, TAG_LIMIT);
        var hasMore = isMobile && !expanded && cachedTags.length > TAG_LIMIT;

        visibleTags.forEach(function (tag) {
            var el = document.createElement("button");
            el.type = "button";
            el.className = "archive-tag";
            var key = tag.name.toLowerCase();
            if (activeTags[key]) {
                el.classList.add("active");
            }

            var nameSpan = document.createElement("span");
            nameSpan.textContent = tag.name.toUpperCase();
            el.appendChild(nameSpan);

            var countSpan = document.createElement("span");
            countSpan.className = "archive-tag-count";
            countSpan.textContent = " " + tag.count;
            el.appendChild(countSpan);

            el.onclick = function () { onTagClick(key); };
            container.appendChild(el);
        });

        if (hasMore) {
            var moreBtn = document.createElement("button");
            moreBtn.type = "button";
            moreBtn.className = "archive-tag archive-tag-more";
            moreBtn.textContent = "MORE (" + (cachedTags.length - TAG_LIMIT) + ")";
            moreBtn.onclick = function () {
                container.dataset.expanded = "true";
                renderTags();
            };
            container.appendChild(moreBtn);
        }

        if (isMobile && expanded && cachedTags.length > TAG_LIMIT) {
            var lessBtn = document.createElement("button");
            lessBtn.type = "button";
            lessBtn.className = "archive-tag archive-tag-more";
            lessBtn.textContent = "LESS";
            lessBtn.onclick = function () {
                container.dataset.expanded = "false";
                renderTags();
            };
            container.appendChild(lessBtn);
        }
    }

    function getMixcloudSlug(url) {
        if (!url) return "";
        var parts = url.replace(/\/+$/, "").split("/");
        return parts[parts.length - 1] || "";
    }

    function formatDuration(seconds) {
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return h + "h " + m + "m";
        return m + "m";
    }

    function renderShows() {
        var container = document.getElementById("archive-content");
        if (!container) return;

        var shows = getFilteredShows();
        container.innerHTML = "";

        var searchEl = document.getElementById("archive-search");
        var query = searchEl ? searchEl.value.toLowerCase().trim() : "";

        var countEl = document.createElement("div");
        countEl.className = "archive-count";
        countEl.textContent = shows.length + " show" + (shows.length !== 1 ? "s" : "") + " (by recent uploads)";
        container.appendChild(countEl);

        if (query === "goty") {
            var warn = document.createElement("div");
            warn.className = "archive-warning";
            warn.textContent = "warning: most likely rigged. discuss here chuntoo.chatango.com.";
            container.appendChild(warn);
        }

        if (shows.length === 0) {
            var p = document.createElement("p");
            p.className = "placeholder";
            p.textContent = "no matches";
            container.appendChild(p);
            return;
        }

        shows.forEach(function (show) {
            var entry = document.createElement("div");
            entry.className = "archive-entry";

            // Set ID from Mixcloud URL slug for deep linking
            var slug = getMixcloudSlug(show.url);
            if (slug) entry.id = slug;

            var date = document.createElement("span");
            date.className = "archive-date";
            date.textContent = show.info ? show.info.date || "" : "";
            entry.appendChild(date);

            var title = document.createElement("a");
            title.className = "archive-title";
            title.href = show.url || "#";
            title.target = "_blank";
            title.rel = "noopener";
            title.textContent = show.info ? show.info.title || show.name : show.name;
            entry.appendChild(title);

            var duration = document.createElement("span");
            duration.className = "archive-duration";
            duration.textContent = formatDuration(show.audio_length || 0);
            entry.appendChild(duration);

            var tags = show.info && show.info.tags ? show.info.tags : [];
            if (tags.length > 0) {
                var genres = document.createElement("span");
                genres.className = "archive-genres";
                genres.textContent = tags.join(", ");
                entry.appendChild(genres);
            }

            container.appendChild(entry);
        });
    }

    function render() {
        renderTags();
        renderShows();
        scrollToHash();
    }

    function scrollToHash() {
        var hash = window.location.hash;
        if (!hash) return;
        var el = document.getElementById(hash.slice(1));
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("archive-highlight");
        }
    }

    function loadEmbeddedData() {
        var el = document.getElementById("archive-data");
        if (!el) return false;
        try {
            var data = JSON.parse(el.textContent);
            cachedShows = data;
            cachedTags = extractTags(data);
            return true;
        } catch (e) {
            return false;
        }
    }

    function init() {
        var content = document.getElementById("archive-content");
        if (!content) return;

        var searchEl = document.getElementById("archive-search");
        if (searchEl) {
            searchEl.oninput = function () { render(); };
        }

        if (cachedShows) {
            render();
        } else if (loadEmbeddedData()) {
            render();
        } else {
            fetchArchive();
        }
    }

    window.__initArchive = function () {
        init();
    };

    document.addEventListener("DOMContentLoaded", init);
})();
