(function () {
    "use strict";

    var config = window.SITE_CONFIG;
    var apiBase = config.api.base;

    var nowContent = document.getElementById("now-content");
    var upnextContent = document.getElementById("upnext-content");
    var previousContent = document.getElementById("previous-content");
    var tzToggle = document.getElementById("tz-toggle");
    var tzLabel = document.getElementById("tz-label");

    var useUTC = localStorage.getItem("timeDisplayMode") === "utc";

    // --- Timezone toggle ---

    function getLocalTzAbbr() {
        try {
            return new Date().toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop();
        } catch (e) {
            return "local";
        }
    }

    function updateTzLabel() {
        if (!tzLabel) return;
        tzLabel.textContent = "(" + getLocalTzAbbr() + ")";
    }

    if (tzToggle) {
        tzToggle.checked = !useUTC;
        tzToggle.addEventListener("change", function () {
            useUTC = !this.checked;
            localStorage.setItem("timeDisplayMode", useUTC ? "utc" : "local");
            reRenderAll();
        });
    }

    // --- Time formatting ---

    function formatTime(dateStr) {
        try {
            var d = new Date(dateStr);
            if (isNaN(d.getTime())) return "";
            if (useUTC) {
                var h = String(d.getUTCHours()).padStart(2, "0");
                var m = String(d.getUTCMinutes()).padStart(2, "0");
                return h + ":" + m;
            }
            var h = String(d.getHours()).padStart(2, "0");
            var m = String(d.getMinutes()).padStart(2, "0");
            return h + ":" + m;
        } catch (e) {
            return "";
        }
    }

    function formatTimeRange(start, end) {
        if (!start) return "";
        var result = formatTime(start);
        if (end) {
            var endStr = formatTime(end);
            var ds = new Date(start);
            var de = new Date(end);
            if (!isNaN(ds.getTime()) && !isNaN(de.getTime())) {
                var startDay = useUTC ? ds.getUTCDate() : ds.getDate();
                var endDay = useUTC ? de.getUTCDate() : de.getDate();
                if (startDay !== endDay) {
                    var mo = useUTC
                        ? de.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
                        : de.toLocaleString("en-US", { month: "short" });
                    endStr += " (" + mo + " " + (useUTC ? de.getUTCDate() : de.getDate()) + ")";
                }
            }
            result += " - " + endStr;
        }
        return result;
    }

    // --- Data store (for re-rendering on tz switch) ---

    var cachedNow = null;
    var cachedUpnext = null;

    function reRenderAll() {
        renderShows(nowContent, cachedNow, "no live show");
        renderShows(upnextContent, cachedUpnext, "I'm coming up");
        redrawPrevious();
    }

    // --- Rendering ---

    function getShowDate(show) {
        var dateStr = show.start || show.starttime;
        if (!dateStr) return null;
        try {
            var d = new Date(dateStr);
            if (isNaN(d.getTime())) return null;
            if (useUTC) {
                return d.getUTCFullYear() + "-" +
                    String(d.getUTCMonth() + 1).padStart(2, "0") + "-" +
                    String(d.getUTCDate()).padStart(2, "0");
            }
            return d.getFullYear() + "-" +
                String(d.getMonth() + 1).padStart(2, "0") + "-" +
                String(d.getDate()).padStart(2, "0");
        } catch (e) {
            return null;
        }
    }

    function formatDateHeading(dateKey) {
        try {
            var parts = dateKey.split("-");
            var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            var weekday = d.toLocaleDateString("en-US", { weekday: "short" });
            return weekday + " " + dateKey;
        } catch (e) {
            return dateKey;
        }
    }

    function groupByDay(shows) {
        var groups = [];
        var groupMap = {};
        shows.forEach(function (show) {
            var key = getShowDate(show) || "unknown";
            if (!groupMap[key]) {
                groupMap[key] = [];
                groups.push(key);
            }
            groupMap[key].push(show);
        });
        return { keys: groups, map: groupMap };
    }

    // Renders API-provided text that may contain HTML. Whitelist approach:
    // a (http/https href only), b, i, em, strong, u, br, img (http/https src
    // only); p is converted to a line break. Unknown tags are dropped but
    // their text content is kept; script/style are dropped entirely. Never
    // uses innerHTML on the live page, so nothing outside the whitelist can
    // reach the DOM.
    function appendSanitizedHtml(el, text) {
        var doc;
        try {
            doc = new DOMParser().parseFromString(text, "text/html");
        } catch (e) {
            el.appendChild(document.createTextNode(text));
            return;
        }
        copySanitized(el, doc.body);
    }

    function copySanitized(target, node) {
        var children = node.childNodes;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child.nodeType === 3) {
                target.appendChild(document.createTextNode(child.nodeValue));
            } else if (child.nodeType === 1) {
                var tag = child.tagName;
                if (tag === "BR") {
                    target.appendChild(document.createElement("br"));
                } else if (tag === "A") {
                    var href = child.getAttribute("href") || "";
                    if (/^https?:\/\//i.test(href)) {
                        var a = document.createElement("a");
                        a.href = href;
                        a.target = "_blank";
                        a.rel = "noopener";
                        copySanitized(a, child);
                        if (!a.textContent) a.textContent = href;
                        target.appendChild(a);
                    } else {
                        copySanitized(target, child);
                    }
                } else if (tag === "IMG") {
                    var src = child.getAttribute("src") || "";
                    if (/^https?:\/\//i.test(src)) {
                        var img = document.createElement("img");
                        img.src = src;
                        img.alt = child.getAttribute("alt") || "";
                        img.loading = "lazy";
                        img.className = "show-img";
                        target.appendChild(img);
                    }
                } else if (tag === "B" || tag === "I" || tag === "EM" || tag === "STRONG" || tag === "U") {
                    var inline = document.createElement(tag.toLowerCase());
                    copySanitized(inline, child);
                    target.appendChild(inline);
                } else if (tag === "P") {
                    copySanitized(target, child);
                    target.appendChild(document.createElement("br"));
                } else if (tag !== "SCRIPT" && tag !== "STYLE") {
                    copySanitized(target, child);
                }
            }
        }
    }

    function stripTags(text) {
        return text.replace(/<[^>]*>/g, "");
    }

    function renderShow(show) {
        var div = document.createElement("div");
        div.className = "show-entry";
        if (show.not_live) div.classList.add("show-not-live");

        if (show.restream) {
            var restreamEl = document.createElement("div");
            restreamEl.className = "restream-label";
            restreamEl.textContent = "restream";
            div.appendChild(restreamEl);
        }

        if (show.unscheduled) {
            var nowEl = document.createElement("div");
            nowEl.className = "show-time";
            nowEl.textContent = "NOW";
            div.appendChild(nowEl);
        } else {
            var timeRange = formatTimeRange(show.start || show.starttime, show.stop || show.end || show.endtime);
            if (timeRange) {
                var timeEl = document.createElement("div");
                timeEl.className = "show-time";
                timeEl.textContent = timeRange;
                div.appendChild(timeEl);
            }
        }

        var title = show.title || show.name || "Untitled";
        var titleEl = document.createElement("div");
        titleEl.className = "show-title";
        if (show.restream && show.show_url) {
            var slug = show.show_url.replace(/\/+$/, "").split("/").pop();
            if (slug) {
                var titleLink = document.createElement("a");
                titleLink.href = "/archive/#" + slug;
                titleLink.className = "show-title-link";
                titleLink.textContent = title;
                titleEl.appendChild(titleLink);
            } else {
                titleEl.textContent = title;
            }
            var linkEl = document.createElement("a");
            linkEl.href = show.show_url;
            linkEl.target = "_blank";
            linkEl.rel = "noopener";
            linkEl.className = "restream-mixcloud-link";
            linkEl.setAttribute("aria-label", "Listen to " + title + " on Mixcloud");
            linkEl.innerHTML = '<svg class="restream-mixcloud-icon" viewBox="0 0 640 512" aria-hidden="true"><path fill="currentColor" d="M212.98 346.566H179.789V195.114L185.973 173.47H175.262L137.127 346.566H76.1069L37.7323 173.47H27.276L33.1913 195.114V346.566H0V165H65.6506L102.248 338.096H110.747L147.329 165H212.98L212.98 346.566ZM544.459 283.589L458.434 345.655V307.534L531.329 255.776L458.434 204.017V165.896L544.459 228.231H553.721L640 165.896V204.017L566.866 255.776L640 307.549V345.655L553.721 283.589H544.459ZM430.157 272.311H248.113V239.255H430.157V272.311Z"/></svg>';
            titleEl.appendChild(document.createTextNode(" "));
            titleEl.appendChild(linkEl);
            if (show.show_date) {
                var airedEl = document.createElement("span");
                airedEl.className = "restream-aired";
                airedEl.textContent = "(" + show.show_date + ")";
                airedEl.setAttribute("title", "originally aired on " + show.show_date);
                titleEl.appendChild(document.createTextNode(" "));
                titleEl.appendChild(airedEl);
            }
        } else {
            appendSanitizedHtml(titleEl, title);
        }
        div.appendChild(titleEl);

        if (show.description) {
            var descEl = document.createElement("div");
            descEl.className = "show-description";
            appendSanitizedHtml(descEl, show.description);
            div.appendChild(descEl);
        }

        return div;
    }

    function renderShows(container, shows, emptyMsg) {
        if (!container) return;
        container.innerHTML = "";
        if (!shows || shows.length === 0) {
            var p = document.createElement("p");
            p.className = "placeholder";
            p.textContent = emptyMsg || "nothing scheduled";
            container.appendChild(p);
            return;
        }

        var grouped = groupByDay(shows);

        // Skip day headings if all shows are on the same day
        var showHeadings = grouped.keys.length > 1;

        grouped.keys.forEach(function (key) {
            if (showHeadings && key !== "unknown") {
                var heading = document.createElement("div");
                heading.className = "day-heading";
                heading.textContent = formatDateHeading(key);
                container.appendChild(heading);
            }
            grouped.map[key].forEach(function (show) {
                container.appendChild(renderShow(show));
            });
        });
    }

    // --- API calls ---

    function normalizeResponse(data) {
        if (Array.isArray(data)) return data;
        if (data && typeof data === "object") {
            if (data.shows) return data.shows;
            if (data.data) return Array.isArray(data.data) ? data.data : [data.data];
            return [data];
        }
        return [];
    }

    var miniNowPlaying = document.getElementById("mini-now-playing");

    function okJson(r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
    }

    function fetchNow() {
        return fetch(apiBase + config.api.now_playing)
            .then(okJson)
            .then(function (data) {
                cachedNow = normalizeResponse(data);
                renderShows(nowContent, cachedNow, "no live show");
                // Update mini-player titles (rotate if multiple)
                if (window.setMiniTitles) {
                    var titles = cachedNow
                        .filter(function (s) { return s.title && !s.not_live; })
                        .map(function (s) { return stripTags(s.title); });
                    window.setMiniTitles(titles);
                }
            })
            .catch(function () {});
    }

    function fetchUpnext() {
        if (!upnextContent) return Promise.resolve();
        return fetch(apiBase + config.api.schedule_upnext)
            .then(okJson)
            .then(function (data) {
                cachedUpnext = normalizeResponse(data);
                renderShows(upnextContent, cachedUpnext, "I'm coming up");
            })
            .catch(function () {});
    }

    // --- PREVIOUS: loaded in batches, kept sorted newest first ---

    var PREVIOUS_LIMIT = 50;
    var PREVIOUS_OVERLAP = 5;
    var PREVIOUS_MARGIN = "0px 0px 1500px 0px";
    var PREVIOUS_RETRY_MS = 30000;

    function newPreviousState() {
        return {
            entries: [],
            seen: {},
            nextOffset: 0,
            done: false,
            loading: false,
            refreshing: false,
            observer: null,
            observerRoot: null,
            sentinel: null,
            retryTimer: null,
            lastRefresh: 0
        };
    }

    var prev = newPreviousState();

    function fetchPreviousPage(offset) {
        return fetch(apiBase + config.api.schedule_previous +
            "?limit=" + PREVIOUS_LIMIT + "&offset=" + offset)
            .then(okJson)
            .then(normalizeResponse);
    }

    function createDayHeading(day) {
        var heading = document.createElement("div");
        heading.className = "day-heading";
        heading.textContent = day === "unknown" ? day : formatDateHeading(day);
        return heading;
    }

    function addPreviousShow(show) {
        var key = show.id + "|" + (show.start || show.starttime);
        if (prev.seen[key]) return false;
        prev.seen[key] = true;

        var entries = prev.entries;
        if (entries.length === 0) previousContent.innerHTML = "";

        var entry = {
            show: show,
            time: new Date(show.start || show.starttime).getTime() || 0,
            day: getShowDate(show) || "unknown",
            el: renderShow(show)
        };

        // First position holding an older show
        var low = 0;
        var high = entries.length;
        while (low < high) {
            var mid = (low + high) >> 1;
            if (entries[mid].time < entry.time) high = mid;
            else low = mid + 1;
        }
        var before = entries[low - 1];
        var after = entries[low];

        if (before && before.day === entry.day) {
            previousContent.insertBefore(entry.el, before.el.nextSibling);
        } else if (after && after.day === entry.day) {
            previousContent.insertBefore(entry.el, after.el);
        } else {
            // A different day follows, so its heading is the next element
            var next = after ? after.el.previousSibling : null;
            previousContent.insertBefore(createDayHeading(entry.day), next);
            previousContent.insertBefore(entry.el, next);
        }
        entries.splice(low, 0, entry);
        return true;
    }

    // The element that scrolls the list: its own box if it really scrolls, else the page
    function previousScrollBox() {
        var body = previousContent && previousContent.parentNode;
        if (body && getComputedStyle(body).overflowY === "auto" &&
                body.scrollHeight > body.clientHeight + 1) return body;
        return null;
    }

    // Adds shows while keeping what the visitor is looking at in place
    function addPreviousShows(shows) {
        var box = previousScrollBox();
        var viewTop = box ? box.getBoundingClientRect().top : 0;
        var scrolled = box ? box.scrollTop > 0 : window.pageYOffset > 0;
        var anchor = null;
        if (scrolled && previousContent.getBoundingClientRect().top < viewTop) {
            for (var i = 0; i < prev.entries.length; i++) {
                if (prev.entries[i].el.getBoundingClientRect().bottom > viewTop) {
                    anchor = prev.entries[i].el;
                    break;
                }
            }
        }
        var anchorTop = anchor ? anchor.getBoundingClientRect().top : 0;

        var added = 0;
        shows.forEach(function (show) {
            if (addPreviousShow(show)) added++;
        });

        if (anchor) {
            var delta = anchor.getBoundingClientRect().top - anchorTop;
            if (delta) {
                if (box) box.scrollTop += delta;
                else window.scrollBy(0, delta);
            }
        }
        return added;
    }

    function watchPreviousEnd() {
        if (!window.IntersectionObserver) return;
        var state = prev;
        var box = previousScrollBox();
        if (state.observer) state.observer.disconnect();
        state.observerRoot = box;
        state.observer = new IntersectionObserver(function (items) {
            if (state === prev && items[items.length - 1].isIntersecting) loadMorePrevious();
        }, { root: box, rootMargin: PREVIOUS_MARGIN });
        state.observer.observe(state.sentinel);
    }

    // Observing again reports the current position, even if it has not changed
    function checkPreviousEnd() {
        if (prev.done) return;
        if (!prev.sentinel) {
            prev.sentinel = document.createElement("div");
            prev.sentinel.setAttribute("aria-hidden", "true");
            prev.sentinel.style.height = "1px";
            previousContent.parentNode.insertBefore(prev.sentinel, previousContent.nextSibling);
            watchPreviousEnd();
        } else if (prev.observer) {
            prev.observer.unobserve(prev.sentinel);
            prev.observer.observe(prev.sentinel);
        }
        if (!window.IntersectionObserver) loadMorePrevious();
    }

    function finishPrevious() {
        prev.done = true;
        if (prev.observer) prev.observer.disconnect();
        prev.observer = null;
        if (prev.sentinel) prev.sentinel.remove();
        prev.sentinel = null;
        if (prev.entries.length === 0) {
            renderShows(previousContent, [], "no previous shows");
        }
    }

    function applyPreviousPage(shows, offset) {
        addPreviousShows(shows);
        prev.nextOffset = Math.max(prev.nextOffset, offset + shows.length);
        if (shows.length < PREVIOUS_LIMIT) finishPrevious();
        else checkPreviousEnd();
    }

    function loadMorePrevious() {
        if (prev.loading || prev.done) return;
        var state = prev;
        var offset = Math.max(0, state.nextOffset - PREVIOUS_OVERLAP);
        state.loading = true;
        clearTimeout(state.retryTimer);
        fetchPreviousPage(offset)
            .then(function (shows) {
                if (state !== prev) return;
                state.loading = false;
                applyPreviousPage(shows, offset);
            })
            .catch(function () {
                if (state !== prev) return;
                state.loading = false;
                state.retryTimer = setTimeout(function () {
                    if (state !== prev) return;
                    if (state.entries.length === 0) loadMorePrevious();
                    else checkPreviousEnd();
                }, PREVIOUS_RETRY_MS);
            });
    }

    function resetPrevious() {
        if (prev.observer) prev.observer.disconnect();
        if (prev.sentinel) prev.sentinel.remove();
        clearTimeout(prev.retryTimer);
        prev = newPreviousState();
    }

    function refreshPrevious() {
        if (document.hidden || prev.refreshing) return;
        var state = prev;
        state.refreshing = true;
        state.lastRefresh = Date.now();
        fetchPreviousPage(0)
            .then(function (shows) {
                if (state !== prev) return;
                state.refreshing = false;
                var overlaps = shows.some(function (show) {
                    return state.seen[show.id + "|" + (show.start || show.starttime)];
                });
                if (shows.length > 0 && !overlaps) {
                    // More shows ended than one page holds: start the list again
                    var lastRefresh = state.lastRefresh;
                    resetPrevious();
                    prev.lastRefresh = lastRefresh;
                    previousContent.innerHTML = "";
                    applyPreviousPage(shows, 0);
                    return;
                }
                state.nextOffset += addPreviousShows(shows);
            })
            .catch(function () {
                if (state === prev) state.refreshing = false;
            });
    }

    function fetchPrevious() {
        if (!previousContent) return;
        if (prev.entries.length > 0) {
            refreshPrevious();
        } else {
            prev.done = false;
            prev.lastRefresh = Date.now();
            loadMorePrevious();
        }
    }

    function redrawPrevious() {
        if (!previousContent || prev.entries.length === 0) return;
        previousContent.innerHTML = "";
        var lastDay = null;
        prev.entries.forEach(function (entry) {
            entry.day = getShowDate(entry.show) || "unknown";
            entry.el = renderShow(entry.show);
            if (entry.day !== lastDay) previousContent.appendChild(createDayHeading(entry.day));
            previousContent.appendChild(entry.el);
            lastDay = entry.day;
        });
        checkPreviousEnd();
    }

    // --- Init ---

    function fetchAll() {
        fetchNow().then(function () {
            fetchUpnext();
            fetchPrevious();
        });
    }

    // Re-query swappable DOM containers (called after swup page swap)
    window.__initSchedule = function () {
        nowContent = document.getElementById("now-content");
        upnextContent = document.getElementById("upnext-content");
        previousContent = document.getElementById("previous-content");
        resetPrevious();
        if (nowContent || upnextContent || previousContent) {
            fetchAll();
        }
    };

    document.addEventListener("DOMContentLoaded", function () {
        updateTzLabel();

        // Initial fetch: NOW first, then defer upnext + previous
        fetchAll();

        var pollNow = config.polling.now_playing;
        var pollUpnext = config.polling.schedule_upnext;
        var pollPrevious = config.polling.schedule_previous;

        if (pollNow === 0 || pollUpnext === 0 || pollPrevious === 0) {
            // If any polling value is 0, poll everything together at 30s
            setInterval(fetchAll, 30000);
        } else {
            setInterval(fetchNow, pollNow * 1000);
            setInterval(fetchUpnext, pollUpnext * 1000);
            setInterval(fetchPrevious, pollPrevious * 1000);
        }

        // A hidden tab skips its refreshes, so catch up on return
        var previousInterval = (pollPrevious || 30) * 1000;
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden && previousContent &&
                    Date.now() - prev.lastRefresh >= previousInterval) {
                fetchPrevious();
            }
        });

        // A layout change can move scrolling between the list's box and the page
        window.addEventListener("resize", function () {
            if (prev.sentinel && prev.observer && previousScrollBox() !== prev.observerRoot) {
                watchPreviousEnd();
            }
        });
    });
})();
