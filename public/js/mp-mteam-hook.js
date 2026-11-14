(function () {
  if (window.__mpMTeamPageHookInstalled) return;
  window.__mpMTeamPageHookInstalled = true;
  window.__mpMTeamPrefetchUntil = 0;

  function shouldCapture(url) {
    try {
      var s = String(url || "");
      var lower = s.toLowerCase();
      if (lower.indexOf("dlv2") >= 0) return true;
      if (lower.indexOf("torrent/download") >= 0) return true;
      if (lower.indexOf(".torrent") >= 0) return true;
      if (lower.indexOf("halomt.com") >= 0 && lower.indexOf("sign=") >= 0) return true;
      if (
        (lower.indexOf("app_id=") >= 0 || lower.indexOf("payload=") >= 0 || lower.indexOf("playload=") >= 0) &&
        lower.indexOf("sign=") >= 0
      )
        return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function inPrefetchMode() {
    try {
      return Date.now() < (window.__mpMTeamPrefetchUntil || 0);
    } catch (e) {
      return false;
    }
  }

  try {
    document.addEventListener(
      "mp-mteam-prefetch-mode",
      function (ev) {
        try {
          var duration = Number(ev && ev.detail && ev.detail.duration) || 5000;
          if (duration < 500) duration = 500;
          window.__mpMTeamPrefetchUntil = Date.now() + duration;
        } catch (e) {}
      },
      true,
    );
  } catch (e) {}

  function emit(url, source) {
    try {
      if (!url || !shouldCapture(url)) return;
      document.dispatchEvent(
        new CustomEvent("mp-download-url-captured", { detail: { url: String(url), source: source || "page-hook" } }),
      );
    } catch (e) {}
  }

  try {
    var origOpen = window.open;
    if (typeof origOpen === "function") {
      window.open = function (url) {
        emit(url, "window.open");
        if (inPrefetchMode() && shouldCapture(url)) return null;
        return origOpen.apply(this, arguments);
      };
    }
  } catch (e) {}

  try {
    if (window.fetch) {
      var origFetch = window.fetch;
      window.fetch = function (input) {
        var u = "";
        try {
          u = String(typeof input === "string" ? input : (input && input.url) || "");
          emit(u, "fetch");
        } catch (e) {}
        var resPromise = origFetch.apply(this, arguments);
        try {
          if (u && (u.indexOf("/api/torrent/detail") >= 0 || u.indexOf("/api/torrent/genDlToken") >= 0)) {
            resPromise
              .then(function (resp) {
                try {
                  resp
                    .clone()
                    .json()
                    .then(function (json) {
                      if (!json || !json.data) return;
                      if (u.indexOf("/api/torrent/detail") >= 0 && typeof json.data === "object") {
                        document.dispatchEvent(new CustomEvent("mp-mteam-detail-captured", { detail: json.data }));
                      } else if (u.indexOf("/api/torrent/genDlToken") >= 0 && typeof json.data === "string") {
                        emit(json.data, "fetch.genDlToken");
                      }
                    })
                    .catch(function () {});
                } catch (e) {}
              })
              .catch(function () {});
          }
        } catch (e) {}
        return resPromise;
      };
    }
  } catch (e) {}

  try {
    var origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__mpReqUrl = String(url || "");
      emit(url, "xhr.open");
      return origXhrOpen.apply(this, arguments);
    };
    var origXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      var reqUrl = this.__mpReqUrl || "";
      if (reqUrl && (reqUrl.indexOf("/api/torrent/detail") >= 0 || reqUrl.indexOf("/api/torrent/genDlToken") >= 0)) {
        this.addEventListener("load", function () {
          try {
            var json = JSON.parse(this.responseText || "{}");
            if (!json || !json.data) return;
            if (reqUrl.indexOf("/api/torrent/detail") >= 0 && typeof json.data === "object") {
              document.dispatchEvent(new CustomEvent("mp-mteam-detail-captured", { detail: json.data }));
            } else if (reqUrl.indexOf("/api/torrent/genDlToken") >= 0 && typeof json.data === "string") {
              emit(json.data, "xhr.genDlToken");
            }
          } catch (e) {}
        });
      }
      return origXhrSend.apply(this, arguments);
    };
  } catch (e) {}

  try {
    var origAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      emit(this && this.href, "anchor.click");
      if (inPrefetchMode() && shouldCapture(this && this.href)) return;
      return origAnchorClick.apply(this, arguments);
    };
  } catch (e) {}

  try {
    document.addEventListener(
      "click",
      function (ev) {
        var path = ev.composedPath ? ev.composedPath() : [ev.target];
        for (var i = 0; i < path.length; i++) {
          var n = path[i];
          if (!n || !n.getAttribute) continue;
          emit(n.getAttribute("href"), "dom.click.href");
          emit(n.getAttribute("data-url"), "dom.click.data-url");
          emit(n.getAttribute("data-href"), "dom.click.data-href");
          emit(n.getAttribute("onclick"), "dom.click.onclick");
        }
      },
      true,
    );
  } catch (e) {}
})();
