(function () {
    "use strict";

    var config = window.SITE_CONFIG;
    var streamUrl = config.streams.default;

    var audio = document.getElementById("audio-player");
    var playerCell = document.getElementById("player-section");
    var playLabel = document.getElementById("play-label");
    var stopLabel = document.getElementById("stop-label");
    var miniPlayer = document.getElementById("mini-player");
    var miniPlayBtn = document.getElementById("mini-play-btn");
    var miniStopBtn = document.getElementById("mini-stop-btn");
    var siteTitle = document.getElementById("site-title");
    var jukeboxLabel = document.getElementById("jukebox-label");

    var userPaused = true;
    var reconnectAttempts = 0;
    var maxReconnectAttempts = 20;
    var reconnectTimer = null;
    var lastCurrentTime = 0;

    // --- Volume ---

    var currentVolume = parseFloat(localStorage.getItem("volume"));
    if (isNaN(currentVolume)) currentVolume = 1.0;
    var playerDot = document.getElementById("player-dot");
    var miniVolDot = document.getElementById("mini-vol-dot");

    function setVolume(vol) {
        currentVolume = Math.max(0, Math.min(1, vol));
        try { audio.volume = currentVolume; } catch (e) {}
        localStorage.setItem("volume", currentVolume);
        updateVolumeDots();
    }

    function updateVolumeDots() {
        var minScale = 0.15;
        var scale = minScale + currentVolume * (1 - minScale);
        var pct = Math.round(currentVolume * 100);

        if (playerDot) {
            playerDot.style.setProperty("--vol-scale", scale);
            playerDot.setAttribute("aria-valuenow", pct);
            playerDot.setAttribute("aria-label", "Volume " + pct + "%");
        }
        if (miniVolDot) {
            miniVolDot.style.setProperty("--vol-scale", scale);
            miniVolDot.setAttribute("aria-valuenow", pct);
            miniVolDot.setAttribute("aria-label", "Volume " + pct + "%");
        }
    }

    // --- Volume drag handler ---
    // Tracks vertical drag on an element. Returns whether a drag occurred
    // so callers can distinguish drag from click.

    var volDragState = { dragging: false, moved: false, startX: 0, startY: 0, startVol: 0, horizontal: false };
    var DRAG_THRESHOLD = 5;

    function volDragStart(e, horizontal) {
        volDragState.dragging = true;
        volDragState.moved = false;
        volDragState.horizontal = !!horizontal;
        var point = e.touches ? e.touches[0] : e;
        volDragState.startX = point.clientX;
        volDragState.startY = point.clientY;
        volDragState.startVol = currentVolume;
    }

    function volDragMove(e) {
        if (!volDragState.dragging) return;
        var point = e.touches ? e.touches[0] : e;
        var d = volDragState.horizontal
            ? point.clientX - volDragState.startX
            : volDragState.startY - point.clientY;
        if (Math.abs(d) > DRAG_THRESHOLD) {
            volDragState.moved = true;
        }
        if (volDragState.moved) {
            var delta = d / 150;
            setVolume(volDragState.startVol + delta);
        }
    }

    function volDragEnd() {
        volDragState.dragging = false;
    }

    document.addEventListener("mousemove", volDragMove);
    document.addEventListener("touchmove", volDragMove, { passive: false });
    document.addEventListener("mouseup", volDragEnd);
    document.addEventListener("touchend", volDragEnd);

    function initVolumeDot(dot) {
        if (!dot) return;

        dot.setAttribute("role", "slider");
        dot.setAttribute("aria-valuemin", "0");
        dot.setAttribute("aria-valuemax", "100");
        dot.setAttribute("aria-valuenow", Math.round(currentVolume * 100));
        dot.setAttribute("aria-label", "Volume " + Math.round(currentVolume * 100) + "%");
        dot.setAttribute("tabindex", "0");

        // Keyboard: arrow up/down adjusts volume in 10% steps
        dot.addEventListener("keydown", function (e) {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setVolume(currentVolume + 0.1);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setVolume(currentVolume - 0.1);
            }
        });
    }

    // --- Playback ---

    function timestampedUrl() {
        return streamUrl + "?t=" + Date.now();
    }

    function play() {
        userPaused = false;
        audio.src = timestampedUrl();
        audio.load();
        audio.play().catch(function (e) {
            console.log("Playback start failed:", e);
        });
        reconnectAttempts = 0;
        clearReconnectTimer();
        setPlayerState("loading");
        updateMediaSessionState("playing");
    }

    function stop() {
        userPaused = true;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        clearReconnectTimer();
        setPlayerState("idle");
        updateMediaSessionState("paused");
    }

    function setPlayerState(state) {
        playerCell.classList.remove("playing", "loading");
        if (state === "playing") {
            playerCell.classList.add("playing");
            playerCell.setAttribute("aria-label", "Stop");
        } else if (state === "loading") {
            playerCell.classList.add("loading");
            playerCell.setAttribute("aria-label", "Loading");
        } else {
            playerCell.setAttribute("aria-label", "Play");
        }
        var isPlaying = state === "playing";
        var isActive = state !== "idle";
        playLabel.hidden = isPlaying;
        stopLabel.hidden = !isPlaying;
        miniPlayBtn.hidden = isActive;
        miniStopBtn.hidden = !isActive;
    }

    // --- Channel switching (jukebox mode) ---

    window.switchChannel = function (channel) {
        var wasPlaying = !userPaused;
        if (wasPlaying) stop();

        if (channel === 2 && config.streams.jukebox) {
            streamUrl = config.streams.jukebox;
            siteTitle.classList.add("jukebox");
            jukeboxLabel.classList.add("active");
        } else {
            streamUrl = config.streams.default;
            siteTitle.classList.remove("jukebox");
            jukeboxLabel.classList.remove("active");
        }

        if (wasPlaying) play();
    };

    // --- Reconnection with exponential backoff ---

    function clearReconnectTimer() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function attemptReconnect(reason) {
        if (userPaused) return;

        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            clearReconnectTimer();
            var delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);

            reconnectTimer = setTimeout(function () {
                audio.src = timestampedUrl();
                audio.load();
                audio.play().catch(function () {});
            }, delay);
        } else {
            // Cooldown, then reset and retry
            clearReconnectTimer();
            reconnectTimer = setTimeout(function () {
                reconnectAttempts = 0;
                if (!userPaused) {
                    attemptReconnect(reason + " (auto-retry)");
                }
            }, 60000);
        }
    }

    // --- Audio event handlers ---

    audio.addEventListener("playing", function () {
        reconnectAttempts = 0;
        clearReconnectTimer();
        setPlayerState("playing");
        updateMediaSessionState("playing");
    });

    audio.addEventListener("pause", function () {
        updateMediaSessionState(userPaused ? "paused" : "playing");
    });

    audio.addEventListener("stalled", function () {
        if (!userPaused) setPlayerState("loading");
        attemptReconnect("Stalled");
    });

    audio.addEventListener("error", function () {
        attemptReconnect("Error");
    });

    audio.addEventListener("ended", function () {
        attemptReconnect("Ended");
    });

    // --- Stall detection (every 10s, matching chunt.org) ---

    setInterval(function () {
        if (userPaused) return;

        var stalled = false;

        // Audio says playing but readyState too low
        if (!audio.paused && audio.readyState < 3) {
            stalled = true;
        }

        // Audio says playing but currentTime not advancing
        if (!audio.paused && audio.currentTime === lastCurrentTime && audio.currentTime !== 0) {
            stalled = true;
        }

        // Audio paused unexpectedly (not by user)
        if (audio.paused && !userPaused) {
            stalled = true;
        }

        lastCurrentTime = audio.currentTime;

        if (stalled) {
            attemptReconnect("Stall check");
        }
    }, 10000);

    // --- Visibility change handler ---

    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
            updateMediaSession();
            if (!userPaused && audio.paused) {
                setTimeout(function () {
                    audio.src = timestampedUrl();
                    audio.load();
                    audio.play().catch(function () {});
                }, 500);
            }
        }
    });

    // --- Network change handler ---

    if ("connection" in navigator && "onchange" in navigator.connection) {
        navigator.connection.addEventListener("change", function () {
            if (!userPaused && (audio.paused || audio.readyState < 3)) {
                setTimeout(function () {
                    reconnectAttempts = 0;
                    clearReconnectTimer();
                    audio.src = timestampedUrl();
                    audio.load();
                    audio.play().catch(function () {});
                }, 1000);
            }
        });
    }

    // --- Button handlers ---

    // Player cell: drag = volume, click = play/stop
    playerCell.addEventListener("mousedown", function (e) {
        if (e.target.closest("#audio-player")) return;
        volDragStart(e, true);
    });
    playerCell.addEventListener("touchstart", function (e) {
        if (e.target.closest("#audio-player")) return;
        volDragStart(e, true);
    }, { passive: true });
    playerCell.addEventListener("click", function () {
        if (volDragState.moved) return;
        if (userPaused) { play(); } else { stop(); }
    });
    playerCell.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (userPaused) { play(); } else { stop(); }
        }
    });

    // Mini-player buttons: drag = volume (horizontal), click = play/stop
    miniPlayBtn.addEventListener("mousedown", function (e) { volDragStart(e, true); });
    miniPlayBtn.addEventListener("touchstart", function (e) { volDragStart(e, true); }, { passive: true });
    miniPlayBtn.addEventListener("click", function () {
        if (volDragState.moved) return;
        play();
    });
    miniStopBtn.addEventListener("mousedown", function (e) { volDragStart(e, true); });
    miniStopBtn.addEventListener("touchstart", function (e) { volDragStart(e, true); }, { passive: true });
    miniStopBtn.addEventListener("click", function () {
        if (volDragState.moved) return;
        stop();
    });

    // Mini-player bar: drag = volume (horizontal)
    if (miniPlayer) {
        miniPlayer.addEventListener("mousedown", function (e) {
            if (e.target === miniPlayBtn || e.target === miniStopBtn) return;
            volDragStart(e, true);
        });
        miniPlayer.addEventListener("touchstart", function (e) {
            if (e.target === miniPlayBtn || e.target === miniStopBtn) return;
            volDragStart(e, true);
        }, { passive: true });
    }

    // Spacebar toggle (only when not typing in an input)
    document.addEventListener("keydown", function (e) {
        if (e.key !== " ") return;
        var tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
        e.preventDefault();
        if (userPaused) { play(); } else { stop(); }
    });

    var miniNowPlaying = document.getElementById("mini-now-playing");
    if (miniNowPlaying) {
        miniNowPlaying.addEventListener("click", function () {
            if (volDragState.moved) return;
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    // Double-tap anywhere on mini-player scrolls to top (mobile)
    var lastTapTime = 0;
    if (miniPlayer) {
        miniPlayer.addEventListener("click", function (e) {
            if (volDragState.moved) return;
            if (e.target === miniPlayBtn || e.target === miniStopBtn || e.target === miniNowPlaying) return;
            var now = Date.now();
            if (now - lastTapTime < 400) {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
            lastTapTime = now;
        });
    }

    // --- Media Session API ---

    function getCurrentShowTitle() {
        var nowTitle = document.querySelector("#now-content .show-title");
        if (nowTitle) return nowTitle.textContent.trim();
        return config.site.title;
    }

    function updateMediaSessionState(state) {
        try {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = state;
            }
        } catch (e) {}
    }

    function updateMediaSession() {
        try {
            if (!("mediaSession" in navigator)) return;

            var title = getCurrentShowTitle();

            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: config.site.title,
                album: "LIVE",
                artwork: [
                    { src: config.site.base_path + "/static/images/web/logos/logo_fishe_calm_256.png", sizes: "256x256", type: "image/png" },
                    { src: config.site.base_path + "/static/images/web/logos/logo_fishe_calm_512.png", sizes: "512x512", type: "image/png" }
                ]
            });

            // Livestream: Infinity duration hides the scrubber
            navigator.mediaSession.setPositionState({
                duration: Infinity,
                playbackRate: 1.0,
                position: 0
            });

            navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";
        } catch (e) {}
    }

    function initMediaSession() {
        try {
            if (!("mediaSession" in navigator)) return;

            navigator.mediaSession.setActionHandler("play", play);
            navigator.mediaSession.setActionHandler("pause", stop);
            navigator.mediaSession.setActionHandler("stop", stop);

            // Disable seek for livestream
            try {
                navigator.mediaSession.setActionHandler("seekto", null);
            } catch (e) {
                navigator.mediaSession.setActionHandler("seekto", function () {});
            }

            navigator.mediaSession.playbackState = "paused";
            updateMediaSession();
        } catch (e) {}
    }

    // Refresh metadata every 30s while playing
    setInterval(function () {
        if (!audio.paused) {
            updateMediaSession();
        }
    }, 30000);

    // --- IntersectionObserver for mini-player ---

    var playerSection = document.getElementById("player-section");

    if ("IntersectionObserver" in window && playerSection && miniPlayer) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    miniPlayer.classList.add("hidden");
                } else {
                    miniPlayer.classList.remove("hidden");
                }
            });
        }, { threshold: 0 });

        observer.observe(playerSection);
    }

    // --- Random letter spin ---

    function spinRandomLetter() {
        var labels = [playLabel, stopLabel];
        labels.forEach(function (label) {
            var letters = label.querySelectorAll("span");
            letters.forEach(function (l) { l.classList.remove("spinning-letter"); });
            var idx = Math.floor(Math.random() * letters.length);
            letters[idx].classList.add("spinning-letter");
        });
    }

    // --- Mini-player title rotation ---

    var miniTitles = [];
    var miniTitleIndex = 0;

    var isJukeboxMode = false;

    var origSwitchChannel = window.switchChannel;
    window.switchChannel = function (channel) {
        origSwitchChannel(channel);
        isJukeboxMode = channel === 2 && !!config.streams.jukebox;
        renderMiniTitle();
    };

    window.setMiniTitles = function (titles) {
        miniTitles = titles;
        miniTitleIndex = 0;
        renderMiniTitle();
    };

    function renderMiniTitle() {
        var title = miniTitles.length > 0 ? miniTitles[miniTitleIndex] : "";
        if (isJukeboxMode) {
            miniNowPlaying.innerHTML = "";
            if (title) {
                var struck = document.createElement("span");
                struck.style.textDecoration = "line-through";
                struck.style.opacity = "0.5";
                struck.textContent = title;
                miniNowPlaying.appendChild(struck);
                miniNowPlaying.appendChild(document.createTextNode(" "));
            }
            var jb = document.createElement("span");
            jb.style.color = "var(--highlight)";
            jb.textContent = "JUKEBOX";
            miniNowPlaying.appendChild(jb);
        } else {
            miniNowPlaying.textContent = title;
        }
    }

    function rotateMiniTitle() {
        if (miniTitles.length <= 1) return;
        miniTitleIndex = (miniTitleIndex + 1) % miniTitles.length;
        miniNowPlaying.style.opacity = "0";
        setTimeout(function () {
            renderMiniTitle();
            miniNowPlaying.style.opacity = "1";
        }, 300);
    }

    // --- Init ---

    document.addEventListener("DOMContentLoaded", function () {
        initMediaSession();
        spinRandomLetter();
        setInterval(spinRandomLetter, 600000);
        setInterval(rotateMiniTitle, 5000);
        try { audio.volume = currentVolume; } catch (e) {}
        initVolumeDot(playerDot);
        initVolumeDot(miniVolDot);
        updateVolumeDots();
    });
})();
