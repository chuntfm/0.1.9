(function () {
    "use strict";

    // The menu as a vinyl record: the fishe as spindle hole, a label, three bands of links.
    // Built from the link list in the page, which stays the no-JS fallback and the list view.
    // The loop only runs while the record is open, on screen and moving.

    var host = document.getElementById("record-host");
    var list = document.getElementById("links-list");
    var nav = document.getElementById("links-expanded");
    var toggle = document.getElementById("links-toggle");
    var rpmGroup = document.getElementById("record-rpm");
    var viewBtn = document.getElementById("record-view");
    if (!host || !list || !nav || !toggle || !rpmGroup || !viewBtn) return;

    var cfg = (window.SITE_CONFIG || {}).record || {};
    var slowdown = Number(cfg.slowdown) || 40;
    var settleDelay = Number(cfg.settle_delay) || 4;
    var minStep = 1 / ((Number(cfg.updates_per_second) || 30) + 1);
    var reduced = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var NS = "http://www.w3.org/2000/svg";
    var KICK = 22;
    var FAST = 30;
    var REAL = { 33: 200, 45: 270 };
    var EYE_BOX = "103.728 144.043 737.583 582.787";
    var EYE = "M 472.17 145.561 C 315.54 145.561 178.79 261.991 105.63 435.031 C 127.32 486.321 154.59 532.631 186.3 572.411 L 186.3 435.031 C 221.98 435.031 250.91 463.961 250.91 499.641 L 250.91 639.141 C 259.75 646.571 268.81 653.571 278.06 660.111 L 278.06 435.031 C 313.74 435.031 342.67 463.961 342.67 499.641 L 342.67 696.871 C 351.9 700.931 361.28 704.571 370.77 707.761 L 370.77 549.881 C 406.45 549.881 435.38 578.811 435.38 614.491 L 435.38 722.341 C 447.5 723.771 459.77 724.501 472.17 724.501 C 628.8 724.501 765.55 608.071 838.71 435.031 C 765.55 261.991 628.8 145.561 472.17 145.561 Z M 645.72 558.191 C 577.7 558.191 522.56 503.051 522.56 435.031 C 522.56 367.011 577.7 311.871 645.72 311.871 C 713.74 311.871 768.88 367.011 768.88 435.031 C 768.88 503.051 713.73 558.191 645.72 558.191 Z";
    var BANDS = [
        { inner: 52, outer: 100, size: 21, weight: 700, phase: -52 },
        { inner: 100, outer: 147, size: 15.5, weight: 400, phase: 12 },
        { inner: 147, outer: 197, size: 15.5, weight: 400, phase: -24 }
    ];
    var LABEL_RADIUS = 52;
    var RIM_RADIUS = 197;

    var svg = null;
    var rotor = null;
    var rings = [];
    var angle = 0;
    var cruise = 0;
    var vel = 0;
    var brake = false;
    var seek = null;
    var held = null;
    var down = null;
    var dragging = false;
    var suppress = false;
    var settleIn = 0;
    var isOpen = false;
    var onScreen = true;
    var frame = null;
    var lastTime = 0;

    // Degrees per second at the slowed-down speed
    function slowSpeed(rpm) {
        return REAL[rpm] ? REAL[rpm] / slowdown : 0;
    }

    function norm(d) {
        d = (d + 180) % 360;
        if (d < 0) d += 360;
        return d - 180;
    }

    function el(tag, attrs, parent) {
        var node = document.createElementNS(NS, tag);
        for (var key in attrs) node.setAttribute(key, attrs[key]);
        if (parent) parent.appendChild(node);
        return node;
    }

    function point(r, a) {
        return (r * Math.sin(a)).toFixed(2) + "," + (-r * Math.cos(a)).toFixed(2);
    }

    function arc(r, a0, a1) {
        return "M" + point(r, a0) + " A" + r + "," + r + " 0 " + (a1 - a0 > Math.PI ? 1 : 0) + ",1 " + point(r, a1);
    }

    function setRotation(node, deg) {
        node.setAttribute("transform", "rotate(" + deg.toFixed(3) + ")");
    }

    function measure(label, weight) {
        var text = el("text", { "class": "record-word", "font-size": 100, "font-weight": weight, visibility: "hidden" }, svg);
        text.textContent = label;
        var width = text.getComputedTextLength() / 100;
        svg.removeChild(text);
        return width;
    }

    function keyboardFocused(node) {
        try {
            return node.matches(":focus-visible");
        } catch (e) {
            return false;
        }
    }

    // --- Animation loop ---

    function settling() {
        if (reduced || !cruise || brake || down) return false;
        for (var i = 0; i < rings.length; i++) {
            if (rings[i].angle !== rings[i].home) return true;
        }
        return false;
    }

    function moving() {
        if (seek) return true;
        if (down) return false;
        return Math.abs(vel) > 0.01 || (!brake && cruise > 0) || settling();
    }

    function active() {
        return !!svg && isOpen && onScreen && !host.hidden;
    }

    function step(dt) {
        if (seek) {
            seek.t += dt;
            var u = Math.min(1, seek.t / seek.dur);
            angle = seek.from + (seek.to - seek.from) * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
            if (u >= 1) {
                seek = null;
                vel = 0;
            }
        } else if (!down) {
            var target = brake ? 0 : cruise;
            var rate = brake ? 7 : (Math.abs(vel) > target * 2 ? 1.5 : 3);
            vel += (target - vel) * (1 - Math.exp(-dt * rate));
            if (!target && Math.abs(vel) <= 0.01) vel = 0;
            angle += vel * dt;
        }

        if (settling()) {
            if (settleIn > 0) {
                settleIn -= dt;
            } else {
                rings.forEach(function (ring) {
                    var off = norm(ring.home - ring.angle);
                    ring.angle = Math.abs(off) < 0.02 ? ring.home : ring.angle + off * (1 - Math.exp(-dt * 0.9));
                    setRotation(ring.g, ring.angle);
                });
            }
        }

        setRotation(rotor, angle);
    }

    function tick(now) {
        frame = null;
        if (!active()) return;
        var dt = (now - lastTime) / 1000;
        // Slow enough that the rim moves under a pixel per update; real speed needs every frame
        if (seek || Math.abs(vel) > FAST || dt >= minStep) {
            lastTime = now;
            step(Math.min(0.05, dt));
        }
        if (moving()) frame = requestAnimationFrame(tick);
    }

    function wake() {
        if (frame === null && active() && moving()) {
            lastTime = performance.now();
            frame = requestAnimationFrame(tick);
        }
    }

    // --- Drawing ---

    function addWord(parent, link, ring) {
        var attrs = { href: link.getAttribute("href"), "aria-label": link.textContent };
        if (link.getAttribute("target")) attrs.target = link.getAttribute("target");
        if (link.getAttribute("rel")) attrs.rel = link.getAttribute("rel");
        if (link.hasAttribute("data-slug")) attrs["data-slug"] = link.getAttribute("data-slug");
        if (link.getAttribute("aria-current")) attrs["aria-current"] = link.getAttribute("aria-current");
        var word = el("a", attrs, parent);

        word.addEventListener("pointerenter", function (e) {
            if (e.pointerType === "mouse") {
                brake = true;
                wake();
            }
        });
        word.addEventListener("pointerleave", function () {
            brake = false;
            wake();
        });
        word.addEventListener("click", function (e) {
            if (suppress) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        // Keyboard focus stops the record and brings the word upright
        word.addEventListener("focus", function () {
            if (!keyboardFocused(word)) return;
            brake = true;
            var to = angle - norm(angle + ring.angle + word.__deg);
            if (reduced) {
                angle = to;
                vel = 0;
                setRotation(rotor, angle);
            } else {
                seek = { from: angle, to: to, t: 0, dur: 0.45 };
                wake();
            }
        });
        word.addEventListener("blur", function () {
            brake = false;
            seek = null;
            wake();
        });
        return word;
    }

    function drawBand(band, index, links) {
        var g = el("g", { transform: "rotate(" + band.phase + ")" }, rotor);
        var ring = { g: g, angle: band.phase, home: band.phase, inner: band.inner, outer: band.outer };
        rings.push(ring);

        var mid = (band.inner + band.outer) / 2;
        var base = mid - 0.36 * band.size;
        var id = "record-path-" + index;
        el("path", {
            id: id,
            d: "M0," + (-base) + " A" + base + "," + base + " 0 1,1 0," + base + " A" + base + "," + base + " 0 1,1 0," + (-base),
            fill: "none"
        }, g);

        var widths = links.map(function (link) {
            return measure(link.textContent, band.weight) * band.size;
        });
        var total = widths.reduce(function (sum, w) { return sum + w; }, 0);
        var gap = (2 * Math.PI * base - total) / links.length;
        var offset = gap / 2;

        links.forEach(function (link, i) {
            var a0 = offset / base;
            var a1 = (offset + widths[i]) / base;
            var pad = 7 / base;
            var word = addWord(g, link, ring);
            word.__deg = (a0 + a1) * 90 / Math.PI;
            el("path", { d: arc(mid, a0 - pad, a1 + pad), "class": "record-hit", "stroke-width": band.outer - band.inner }, word);
            el("path", { d: arc(base - band.size * 0.3, a0, a1 - 0.1 * band.size / base), "class": "record-underline" }, word);
            var text = el("text", { "class": "record-word", "font-size": band.size, "font-weight": band.weight }, word);
            el("textPath", { href: "#" + id, startOffset: offset.toFixed(2) }, text).textContent = link.textContent;
            offset += widths[i] + gap;
        });
    }

    function drawEye() {
        var width = 36;
        var height = width * 582.787 / 737.583;
        var eye = el("svg", { x: -width / 2, y: -height / 2, width: width, height: height, viewBox: EYE_BOX, "class": "record-hole", "aria-hidden": "true" }, svg);
        el("path", { d: EYE }, eye);
    }

    // --- Pointer: a band moves on its own, the label turns the whole record ---

    function pointerAngle(e) {
        var box = svg.getBoundingClientRect();
        return Math.atan2(e.clientY - (box.top + box.height / 2), e.clientX - (box.left + box.width / 2)) * 180 / Math.PI;
    }

    function ringAt(e) {
        var box = svg.getBoundingClientRect();
        var r = Math.sqrt(Math.pow(e.clientX - (box.left + box.width / 2), 2) + Math.pow(e.clientY - (box.top + box.height / 2), 2)) * 400 / box.width;
        for (var i = 0; i < rings.length; i++) {
            if (r >= rings[i].inner && r < rings[i].outer) return rings[i];
        }
        return null;
    }

    function bindPointer() {
        svg.addEventListener("pointerdown", function (e) {
            if (e.button) return;
            held = ringAt(e);
            down = { x: e.clientX, y: e.clientY, a: pointerAngle(e), t: performance.now() };
            seek = null;
        });
        svg.addEventListener("pointermove", function (e) {
            if (!down) return;
            if (!dragging && Math.sqrt(Math.pow(e.clientX - down.x, 2) + Math.pow(e.clientY - down.y, 2)) > 6) {
                dragging = true;
                suppress = true;
                svg.setPointerCapture(e.pointerId);
            }
            if (!dragging) return;
            var a = pointerAngle(e);
            var d = norm(a - down.a);
            var now = performance.now();
            down.a = a;
            if (held) {
                held.angle += d;
                setRotation(held.g, held.angle);
            } else {
                angle += d;
                vel = 0.65 * (d / Math.max(0.004, (now - down.t) / 1000)) + 0.35 * vel;
                setRotation(rotor, angle);
            }
            down.t = now;
        });
        function end() {
            if (dragging) {
                dragging = false;
                vel = Math.max(-400, Math.min(400, vel));
                if (held) settleIn = settleDelay;
                setTimeout(function () { suppress = false; }, 60);
            }
            down = null;
            held = null;
            wake();
        }
        svg.addEventListener("pointerup", end);
        svg.addEventListener("pointercancel", end);
    }

    // --- Speed row: 0 stops; pressing the selected 33 or 45 again runs it for real ---

    function bindSpeeds() {
        var buttons = rpmGroup.querySelectorAll("button");
        buttons.forEach(function (button) {
            var rpm = button.getAttribute("data-rpm");
            var selected = button.getAttribute("aria-pressed") === "true";
            if (reduced) {
                selected = rpm === "0";
                button.setAttribute("aria-pressed", selected ? "true" : "false");
            }
            if (selected) cruise = slowSpeed(rpm);

            button.addEventListener("click", function () {
                var real = !reduced && !!REAL[rpm] && button.getAttribute("aria-pressed") === "true" && !button.classList.contains("real");
                cruise = real ? REAL[rpm] : slowSpeed(rpm);
                buttons.forEach(function (other) {
                    var otherRpm = other.getAttribute("data-rpm");
                    var otherReal = other === button && real;
                    other.setAttribute("aria-pressed", other === button ? "true" : "false");
                    other.classList.toggle("real", otherReal);
                    if (REAL[otherRpm]) other.setAttribute("aria-label", otherRpm + " rpm" + (otherReal ? ", real speed" : ""));
                });
                wake();
            });
        });
    }

    function bindView() {
        viewBtn.addEventListener("click", function () {
            var toList = list.hidden;
            list.hidden = !toList;
            host.hidden = toList;
            rpmGroup.hidden = toList;
            viewBtn.textContent = toList ? "show as record" : "show as list";
            wake();
        });
    }

    // Grow the record out of the drop-down's corner
    function aim() {
        var from = toggle.getBoundingClientRect();
        var box = nav.getBoundingClientRect();
        var left = box.left + (box.width - host.offsetWidth) / 2;
        host.style.transformOrigin = (from.left + from.width / 2 - left) + "px " + (from.top + from.height / 2 - box.top) + "px";
    }

    function build() {
        var groups = list.querySelectorAll("ul");
        // Words can only be measured once the host is displayed
        document.documentElement.classList.add("record-ready");
        svg = el("svg", { viewBox: "-200 -200 400 400", "class": "record-disc", role: "group", "aria-label": "Site links as a record" }, host);
        rotor = el("g", {}, svg);
        el("circle", { r: RIM_RADIUS, "class": "record-rim" }, rotor);
        el("circle", { r: LABEL_RADIUS, "class": "record-label" }, rotor);
        BANDS.forEach(function (band, i) {
            if (i < BANDS.length - 1) el("circle", { r: band.outer, "class": "record-line" }, rotor);
            if (groups[i]) drawBand(band, i, Array.prototype.slice.call(groups[i].querySelectorAll("a")));
        });
        drawEye();
        bindPointer();
        bindSpeeds();
        bindView();

        list.hidden = true;
        aim();

        if (window.IntersectionObserver) {
            new IntersectionObserver(function (entries) {
                onScreen = entries[entries.length - 1].isIntersecting;
                wake();
            }).observe(host);
        }
        wake();
    }

    // --- Called from theme.js and swup-init.js ---

    window.__setRecordOpen = function (open) {
        isOpen = open;
        if (open && svg) {
            aim();
            if (!reduced && cruise < FAST) vel = cruise * KICK;
        }
        wake();
    };

    window.__setRecordPage = function (slug) {
        nav.querySelectorAll("[data-slug]").forEach(function (link) {
            if (link.getAttribute("data-slug") === slug) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    };

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(build);
    } else {
        build();
    }
})();
