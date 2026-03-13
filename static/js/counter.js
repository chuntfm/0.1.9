(function () {
    "use strict";

    var startDate = new Date(window.SITE_CONFIG.counter.start_date + "T00:00:00Z");

    function updateCounter() {
        var now = new Date();
        var utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        var utcStart = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
        var days = Math.floor((utcNow - utcStart) / (1000 * 60 * 60 * 24));
        var domain = "chunt" + days + ".org";
        var el = document.getElementById("day-counter");
        if (el) {
            var link = document.createElement("a");
            link.href = "https://" + domain;
            link.textContent = domain;
            link.className = "counter-link";
            el.innerHTML = "";
            el.appendChild(link);
        }
    }

    updateCounter();
})();
