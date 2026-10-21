/* Automancy Academy · natural voices (writer F)
 * Implements the voice hook from docs/CONVENTIONS.md:
 *   window.AUTOMANCY_TTS = { ready, speak(text, {voice: "male"|"female", rate}) => Promise<void>, stop() }
 * - speak() resolves when the clip finishes playing, and also when stop() (or a newer speak()) interrupts it,
 *   so callers' own "still playing?" checks decide what happens next. It REJECTS on any failure
 *   (no key, budget used up, network, autoplay blocked) so the caller falls back to browser speech.
 * - Extras (optional for callers): prefetch(text, opts) warms the cache for the next chunk;
 *   speak(text, {voice, rate, next}) does the same with `next` while `text` plays.
 * - Speed: the clip is generated once at normal speed and played faster/slower with playbackRate,
 *   so every speed shares one cached file. `rate` defaults to the course's #lsnRate control.
 */
(function () {
  "use strict";
  var A = window.AUTOMANCY || {};
  var API = (A.api || "/api").replace(/\/$/, "");
  var audio = new Audio();
  audio.preload = "auto";
  try { audio.preservesPitch = true; audio.mozPreservesPitch = true; audio.webkitPreservesPitch = true; } catch (e) {}
  var urls = new Map();       // "voice|text" → Promise<url>
  var MAX_URLS = 300;
  var playTok = 0;            // increases on every speak/stop
  var settle = null;          // resolver for the clip that's playing
  var unlocked = false;

  var tts = { ready: false, speak: speak, stop: stop, prefetch: prefetch };
  window.AUTOMANCY_TTS = tts;

  function currentRate(opts) {
    var r = opts && Number(opts.rate);
    if (!r) { var el = document.getElementById("lsnRate"); r = el ? Number(el.value) : 1; }
    return r > 0 ? Math.min(2, Math.max(0.5, r)) : 1;
  }
  function keyOf(text, voice) { return (voice === "female" ? "female" : "male") + "|" + text; }

  function fetchUrl(text, voice) {
    var k = keyOf(text, voice);
    if (urls.has(k)) return urls.get(k);
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 25000) : 0;
    var p = fetch(API + "/tts", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(text).slice(0, 1200), voice: voice === "female" ? "female" : "male" }),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok && j && j.url) return j.url;
        if (j && j.fallback && (r.status === 503 || r.status === 401 || r.status === 429)) tts.ready = false;
        throw new Error((j && j.error) || ("TTS " + r.status));
      });
    });
    p.catch(function () { urls.delete(k); });
    urls.set(k, p);
    if (urls.size > MAX_URLS) urls.delete(urls.keys().next().value);
    return p;
  }

  function prefetch(text, opts) {
    if (!tts.ready || !text || String(text).length > 1200) return;
    fetchUrl(String(text), opts && opts.voice).then(function (u) {
      try { var l = document.createElement("link"); l.rel = "prefetch"; l.as = "audio"; l.href = u; document.head.appendChild(l); setTimeout(function () { l.remove(); }, 60000); } catch (e) {}
    }).catch(function () {});
  }

  function detach() {
    audio.onended = audio.onerror = null;
    try { audio.pause(); } catch (e) {}
  }
  function finish() { var s = settle; settle = null; if (s) s.resolve(); }

  function stop() {
    playTok++;
    detach();
    finish();
  }

  function speak(text, opts) {
    opts = opts || {};
    stop();
    var my = playTok;
    if (!tts.ready) return Promise.reject(new Error("Natural voices not ready"));
    if (!text || !String(text).trim()) return Promise.resolve();
    if (String(text).length > 1200) return Promise.reject(new Error("Text too long for one clip"));
    if (opts.next) prefetch(opts.next, opts);
    return new Promise(function (resolve, reject) {
      settle = { resolve: resolve, reject: reject };
      fetchUrl(String(text), opts.voice).then(function (url) {
        if (my !== playTok) return; // interrupted while loading: already resolved by stop()
        audio.onended = function () { if (my === playTok) { detach(); finish(); } };
        audio.onerror = function () { if (my === playTok) fail(new Error("Audio playback failed")); };
        audio.src = url;
        audio.playbackRate = currentRate(opts);
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function (e) { if (my === playTok) fail(e); });
      }).catch(function (e) { if (my === playTok) fail(e); });
    });
    function fail(err) { detach(); var s = settle; settle = null; if (s) s.reject(err instanceof Error ? err : new Error(String(err))); }
  }

  // Follow the course's speed control while a clip plays.
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "lsnRate" && !audio.paused) audio.playbackRate = currentRate();
  });

  // Mobile browsers only allow audio started from a tap. Play a tiny silent clip on the first tap so later
  // clips (which start after a network round-trip) are allowed to play.
  function silentWav() {
    var n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    var w = function (o, s) { for (var i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
    for (var i = 44; i < b.length; i++) b[i] = 128;
    var s = ""; for (var j = 0; j < b.length; j++) s += String.fromCharCode(b[j]);
    return "data:audio/wav;base64," + btoa(s);
  }
  function unlock() {
    if (unlocked || settle) return; unlocked = true;
    document.removeEventListener("pointerdown", unlock, true); document.removeEventListener("keydown", unlock, true);
    try { audio.muted = true; audio.src = silentWav(); var p = audio.play(); var done = function () { if (!settle) { try { audio.pause(); } catch (e) {} } audio.muted = false; };
      if (p && p.then) p.then(done, done); else done(); } catch (e) { audio.muted = false; }
  }
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);

  // Ask the server once whether natural voices are switched on (no characters are spent).
  if (A.user && typeof fetch === "function") {
    fetch(API + "/tts", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : { ready: false }; })
      .then(function (j) { tts.ready = !!(j && j.ready); })
      .catch(function () { tts.ready = false; });
  }
})();
