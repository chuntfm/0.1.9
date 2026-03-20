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
    var cachedPrevious = null;

    function reRenderAll() {
        renderShows(nowContent, cachedNow, "no live show");
        renderShows(upnextContent, cachedUpnext, "nothing coming up");
        renderShows(previousContent, cachedPrevious, "no previous shows");
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
            titleEl.textContent = title;
        }
        div.appendChild(titleEl);

        if (show.description) {
            var descEl = document.createElement("div");
            descEl.className = "show-description";
            descEl.textContent = show.description;
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

    function fetchNow() {
        return fetch(apiBase + config.api.now_playing)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                cachedNow = normalizeResponse(data);
                renderShows(nowContent, cachedNow, "no live show");
                // Update mini-player titles (rotate if multiple)
                if (window.setMiniTitles) {
                    var titles = cachedNow
                        .filter(function (s) { return s.title && !s.not_live; })
                        .map(function (s) { return s.title; });
                    window.setMiniTitles(titles);
                }
            })
            .catch(function () {});
    }

    function fetchUpnext() {
        if (!upnextContent) return Promise.resolve();
        return fetch(apiBase + config.api.schedule_upnext)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                cachedUpnext = normalizeResponse(data);
                renderShows(upnextContent, cachedUpnext, "nothing coming up");
            })
            .catch(function () {});
    }

    function fetchPrevious() {
        if (!previousContent) return;
        fetch(apiBase + config.api.schedule_previous)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                cachedPrevious = normalizeResponse(data).reverse();
                renderShows(previousContent, cachedPrevious, "no previous shows");
            })
            .catch(function () {});
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
    });
})();
