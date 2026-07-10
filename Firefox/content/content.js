/**
 * ============================================================================
 * Youtube Smooth — Content Script Logic
 * Copyright (c) 2026 Yuvatech Solutions USA LLC & Satish Mishra. All rights reserved.
 * ============================================================================
 *
 * This content script is injected directly into YouTube pages.
 *
 * Key Operations:
 * 1. Read toggle states from browser storage (ads and shorts toggles).
 * 2. Toggle helper classes on the root <html> element to apply CSS hiding rules.
 * 3. Use storage change listeners to update settings dynamically without reloading.
 * 4. Strip ad data from YouTube's player configuration before the player loads.
 * 5. Handle Shorts URLs redirection, sending visitors from /shorts/ to the watch page.
 *
 * ── HOW TO USE THIS EXTENSION ───────────────────────────────────────────────
 *
 * INSTALLATION (Temporary — for development/testing):
 *   1. Open Firefox and navigate to "about:debugging" in the address bar.
 *   2. Click "This Firefox" in the left sidebar.
 *   3. Click "Load Temporary Add-on..." button.
 *   4. Browse to the extension folder and select "manifest.json".
 *   5. The extension icon (shield) will appear in the Firefox toolbar.
 *
 * USAGE:
 *   - Click the shield icon in the toolbar to open the popup.
 *   - Use the "Block Ads" toggle to enable/disable YouTube ad blocking.
 *   - Use the "Block Shorts" toggle to enable/disable YouTube Shorts hiding.
 *   - Use the "Block Posts" toggle to enable/disable YouTube Community Posts hiding.
 *   - All three toggles default to ON. Changes take effect instantly (no reload).
 *   - Settings are saved automatically and persist across browser restarts.
 *
 * PERMANENT INSTALLATION:
 *   - Package as .xpi and sign via https://addons.mozilla.org
 *   - Or set xpinstall.signatures.required = false in about:config
 *     (Firefox Developer/Nightly editions only)
 * ============================================================================
 */

(function () {
  'use strict';
  // Cross-browser compatibility for browser/chrome storage API
  const extensionStorage = (typeof browser !== 'undefined' && browser.storage) 
    ? browser.storage.local 
    : chrome.storage.local;

  // Active configurations
  let blockAdsActive = true;
  let blockShortsActive = true;
  let blockPostsActive = true;
  let bgPlaybackActive = true;

  // Track the current URL to detect SPA (Single Page Application) navigation in YouTube
  let lastUrl = location.href;

  /**
   * ── 1. CONFIGURATION INITIALIZATION ───────────────────────────────────────
   */

  // Update root element HTML classes based on current active configs
  function updateHtmlClasses() {
    const root = document.documentElement;
    if (!root) return;

    if (blockAdsActive) {
      root.classList.add('yt-block-ads');
    } else {
      root.classList.remove('yt-block-ads');
    }

    if (blockShortsActive) {
      root.classList.add('yt-block-shorts');
    } else {
      root.classList.remove('yt-block-shorts');
    }

    if (blockPostsActive) {
      root.classList.add('yt-block-posts');
    } else {
      root.classList.remove('yt-block-posts');
    }
  }

  // Load configuration settings
  function initializeSettings() {
    const defaultSettings = {
      blockAds: true,
      blockShorts: true,
      blockPosts: true,
      bgPlayback: true
    };

    extensionStorage.get(defaultSettings, (items) => {
      blockAdsActive = (items && items.blockAds !== undefined) ? items.blockAds : true;
      blockShortsActive = (items && items.blockShorts !== undefined) ? items.blockShorts : true;
      blockPostsActive = (items && items.blockPosts !== undefined) ? items.blockPosts : true;
      bgPlaybackActive = (items && items.bgPlayback !== undefined) ? items.bgPlayback : true;

      updateHtmlClasses();
      handleShortsRedirect();
      updateBackgroundPlayback();
      updateAdStripping();
    });
  }

  // Listen to configuration updates from the popup UI
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener(onSettingsChanged);
  } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(onSettingsChanged);
  }

  function onSettingsChanged(changes, areaName) {
    if (areaName !== 'local') return;

    if (changes.blockAds) {
      blockAdsActive = changes.blockAds.newValue;
    }
    if (changes.blockShorts) {
      blockShortsActive = changes.blockShorts.newValue;
    }
    if (changes.blockPosts) {
      blockPostsActive = changes.blockPosts.newValue;
    }
    if (changes.bgPlayback) {
      bgPlaybackActive = changes.bgPlayback.newValue;
      updateBackgroundPlayback();
    }

    updateHtmlClasses();
    handleShortsRedirect();
    updateAdStripping();
  }

  /**
   * ── 2. SHORTS REDIRECTION HANDLER ─────────────────────────────────────────
   * If the user goes to a /shorts/ video, this converts the URL to a standard
   * watch page layout (e.g. /shorts/abc -> /watch?v=abc) and performs a redirect.
   */
  function handleShortsRedirect() {
    if (!blockShortsActive) return;

    if (location.pathname.startsWith('/shorts/')) {
      const videoId = location.pathname.split('/')[2];
      if (videoId) {
        // Redirect to standard watch player view
        const watchUrl = `${location.origin}/watch?v=${videoId}${location.search}${location.hash}`;
        location.replace(watchUrl);
      }
    }
  }

  // Detect internal SPA transitions in YouTube.
  // YouTube fires a custom 'yt-navigate-finish' event on SPA page transitions.
  // This is far more efficient than a MutationObserver on the entire document.
  document.addEventListener('yt-navigate-finish', () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      handleShortsRedirect();
    }
  });

  // Fallback: also listen to popstate for browser back/forward navigation
  window.addEventListener('popstate', () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      handleShortsRedirect();
    }
  });


  /**
   * ── 2b. BACKGROUND AUDIO PLAYBACK ──────────────────────────────────────────
   * Overrides the Page Visibility API so YouTube never detects that the browser
   * has been minimized or the screen has been locked. Without this, YouTube
   * pauses the video when the page becomes hidden (enforcing YouTube Premium).
   *
   * IMPORTANT — MAIN WORLD INJECTION:
   * Content scripts run in an isolated world. YouTube's JS runs in the page
   * world. Overriding document.hidden in the content script does NOT affect
   * what YouTube sees. We must inject a <script> tag into the DOM so the
   * override code executes in the same JS context as YouTube's player code.
   *
   * When enabled, this:
   * 1. Injects page-world script to override document.hidden → false
   * 2. Injects page-world script to override document.visibilityState → "visible"
   * 3. Blocks visibilitychange/pagehide events at the capture phase via
   *    stopImmediatePropagation so already-registered listeners never fire
   * 4. Runs a keepalive interval that detects and resumes paused video elements
   *    (safety net for Android screen-lock scenarios)
   *
   * This mirrors the technique used by Mozilla's "Video Background Play Fix"
   * extension. Works on Firefox Android (Fenix) and Firefox Desktop.
   */
  let bgPlaybackInstalled = false;
  let bgKeepaliveInterval = null;
  let bgAudioCtx = null;

  function updateBackgroundPlayback() {
    if (bgPlaybackActive && !bgPlaybackInstalled) {
      enableBackgroundPlayback();
    } else if (!bgPlaybackActive && bgPlaybackInstalled) {
      disableBackgroundPlayback();
    }
  }

  function enableBackgroundPlayback() {
    if (bgPlaybackInstalled) return;
    bgPlaybackInstalled = true;

    // ── Inject overrides into the PAGE world ──
    // We use Firefox's privileged wrappedJSObject API to directly access and
    // modify page-world objects. This bypasses YouTube's Content Security
    // Policy (CSP) which would silently block inline <script> tag injection.
    const pageWindow = window.wrappedJSObject;

    // ── Override Page Visibility API in the page world ──
    exportFunction(() => false, pageWindow.document, { defineAs: '__bgPlayHiddenGetter' });
    pageWindow.Object.defineProperty(pageWindow.document, 'hidden', {
      configurable: true,
      get: pageWindow.document.__bgPlayHiddenGetter
    });

    exportFunction(() => 'visible', pageWindow.document, { defineAs: '__bgPlayVisStateGetter' });
    pageWindow.Object.defineProperty(pageWindow.document, 'visibilityState', {
      configurable: true,
      get: pageWindow.document.__bgPlayVisStateGetter
    });

    // ── Block visibilitychange/pagehide events at capture phase ──
    // Must be registered BEFORE YouTube's code loads (called at document_start)
    const blockEvent = exportFunction(function(e) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }, pageWindow);

    pageWindow.document.addEventListener('visibilitychange', blockEvent, true);
    pageWindow.document.addEventListener('pagehide', blockEvent, true);
    pageWindow.document.addEventListener('freeze', blockEvent, true);
    pageWindow.addEventListener('blur', blockEvent, true);

    // ── Intercept future addEventListener calls for visibility events ──
    const origAdd = pageWindow.EventTarget.prototype.addEventListener;
    pageWindow.EventTarget.prototype.addEventListener = exportFunction(function(type, listener, opts) {
      if (type === 'visibilitychange' || type === 'pagehide' || type === 'freeze') {
        return; // silently discard
      }
      return origAdd.call(this, type, listener, opts);
    }, pageWindow);

    // ── Intercept video.pause() — critical for Android ──
    // On Android, the browser engine itself calls video.pause() when the
    // app is backgrounded or the screen is locked. YouTube's mobile player
    // also calls pause() on visibility change. We intercept pause() and
    // only allow it when the user explicitly pauses (i.e. page is "visible"
    // per the real browser state, meaning user is actively looking at it).
    const origPause = pageWindow.HTMLMediaElement.prototype.pause;
    pageWindow.HTMLMediaElement.prototype.pause = exportFunction(function() {
      // Allow pause only if the page is truly visible (user-initiated).
      // We check the REAL hidden state by reading from the prototype
      // (our override is on the document instance, not the prototype).
      const reallyHidden = Object.getOwnPropertyDescriptor(
        pageWindow.Document.prototype, 'hidden'
      );
      const isReallyHidden = reallyHidden ? reallyHidden.get.call(pageWindow.document) : false;

      if (isReallyHidden) {
        // Page is actually hidden (minimized/screen locked) — block the pause
        return;
      }
      // Page is visible — user clicked pause, allow it
      return origPause.call(this);
    }, pageWindow);

    // ── Audio context keepalive (Android) ──
    // On Android, setInterval is heavily throttled when backgrounded.
    // A silent AudioContext oscillator keeps the audio pipeline active,
    // preventing Android from suspending the tab's audio processing.
    try {
      bgAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = bgAudioCtx.createOscillator();
      const gain = bgAudioCtx.createGain();
      gain.gain.value = 0; // completely silent
      oscillator.connect(gain);
      gain.connect(bgAudioCtx.destination);
      oscillator.start();
    } catch (e) { /* AudioContext not available — fall back to interval */ }

    // ── Keepalive: resume paused videos (secondary safety net) ──
    bgKeepaliveInterval = setInterval(() => {
      const videos = document.querySelectorAll('video');
      videos.forEach((video) => {
        if (video.paused && !video.ended && video.readyState >= 2 && video.currentTime > 0) {
          video.play().catch(() => { /* ignore autoplay policy errors */ });
        }
      });
    }, 500);

    // Store references for cleanup
    pageWindow.__ytBgPlayCleanup = exportFunction(function() {
      pageWindow.document.removeEventListener('visibilitychange', blockEvent, true);
      pageWindow.document.removeEventListener('pagehide', blockEvent, true);
      pageWindow.document.removeEventListener('freeze', blockEvent, true);
      pageWindow.removeEventListener('blur', blockEvent, true);
      pageWindow.EventTarget.prototype.addEventListener = origAdd;
      pageWindow.HTMLMediaElement.prototype.pause = origPause;
      delete pageWindow.document.hidden;
      delete pageWindow.document.visibilityState;
      delete pageWindow.document.__bgPlayHiddenGetter;
      delete pageWindow.document.__bgPlayVisStateGetter;
      delete pageWindow.__ytBgPlayCleanup;
    }, pageWindow);
  }

  function disableBackgroundPlayback() {
    if (!bgPlaybackInstalled) return;
    bgPlaybackInstalled = false;

    // Run the cleanup function we exported into the page world
    try {
      const pageWindow = window.wrappedJSObject;
      if (pageWindow.__ytBgPlayCleanup) {
        pageWindow.__ytBgPlayCleanup();
      }
    } catch (e) { /* ignore */ }

    // Stop the audio context keepalive
    if (bgAudioCtx) {
      bgAudioCtx.close().catch(() => {});
      bgAudioCtx = null;
    }

    // Stop the keepalive interval
    if (bgKeepaliveInterval) {
      clearInterval(bgKeepaliveInterval);
      bgKeepaliveInterval = null;
    }
  }

  // ── CRITICAL: Apply background playback overrides IMMEDIATELY ──
  // Since bgPlaybackActive defaults to true and this script runs at
  // document_start, we must install the overrides NOW — before YouTube's
  // code loads and registers its own visibilitychange listeners.
  // If the async storage read later reveals the user disabled it,
  // disableBackgroundPlayback() will cleanly remove everything.
  // Wrapped in try-catch so a failure here does NOT crash the entire
  // extension (ad blocker, shorts blocker, etc. are defined after this).
  try {
    enableBackgroundPlayback();
  } catch (e) {
    // wrappedJSObject or exportFunction may not be available yet at
    // document_start. The fallback is initializeSettings() which will
    // call updateBackgroundPlayback() after the async storage read.
    bgPlaybackInstalled = false;
  }


  /**
   * ── 3. PRE-LOAD AD DATA STRIPPING ──────────────────────────────────────────
   * Instead of letting ads load and then skipping them (which YouTube detects
   * and triggers the "video player will be blocked" warning), this intercepts
   * YouTube's player configuration data and strips ad-related fields BEFORE
   * the player processes them.
   *
   * Because the player never enters an ad state, there's nothing anomalous
   * for YouTube's anti-adblock telemetry to detect — no skipped timelines,
   * no clicked skip buttons, no ad-showing class toggled.
   *
   * Uses Firefox's wrappedJSObject / exportFunction APIs to inject
   * interception code into the page world (same technique as background
   * playback in Section 2b).
   *
   * Interception layers:
   *   Layer 1: Trap ytInitialPlayerResponse global variable (inline config)
   *   Layer 2: Override Response.prototype.json (SPA navigation fetches)
   *   Layer 3: Anti-adblock popup dismissal (safety net)
   */

  let adStripInstalled = false;

  function updateAdStripping() {
    if (blockAdsActive && !adStripInstalled) {
      installAdDataStripping();
    } else if (!blockAdsActive && adStripInstalled) {
      uninstallAdDataStripping();
    }
  }

  function installAdDataStripping() {
    if (adStripInstalled) return;
    adStripInstalled = true;

    const pageWindow = window.wrappedJSObject;

    // ── Export the ad-field cleaner into the page world ──
    // Strips ad-related properties from YouTube's player configuration objects.
    // Field names are defined inline (inside the exported function) so the
    // array lives in the page world — avoiding Xray wrapper issues.
    const cleanAds = exportFunction(function(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      var fields = [
        'adPlacements', 'playerAds', 'adSlots',
        'adBreakParams', 'adBreakHeartbeatParams',
        'adSignalsInfo', 'attestation',
        'playerAdsConfig', 'enforcementData'
      ];
      for (var i = 0; i < fields.length; i++) {
        try { delete obj[fields[i]]; } catch(e) {}
      }
      // Some API responses nest the player data one level deeper
      if (obj.playerResponse) {
        for (var j = 0; j < fields.length; j++) {
          try { delete obj.playerResponse[fields[j]]; } catch(e) {}
        }
      }
      // Strip enforcement messages from page-level data
      if (obj.overlay && obj.overlay.reelPlayerOverlayRenderer) {
        try { delete obj.overlay.reelPlayerOverlayRenderer.adPlacements; } catch(e) {}
      }
      return obj;
    }, pageWindow);

    pageWindow.__ytCleanAds = cleanAds;

    // ── Layer 1: Trap ytInitialPlayerResponse ──────────────────────────────
    // YouTube sets this global variable with inline player config embedded
    // in the page HTML. We intercept the setter and strip ad data before
    // the player reads it.
    var _storedResponse = pageWindow.ytInitialPlayerResponse || null;
    if (_storedResponse) cleanAds(_storedResponse);

    pageWindow.Object.defineProperty(pageWindow, 'ytInitialPlayerResponse', {
      configurable: true,
      enumerable: true,
      get: exportFunction(function() { return _storedResponse; }, pageWindow),
      set: exportFunction(function(val) {
        if (val && typeof val === 'object') {
          pageWindow.__ytCleanAds(val);
        }
        _storedResponse = val;
      }, pageWindow)
    });

    // ── Layer 2a: Override JSON.parse ──────────────────────────────────────
    // YouTube often reads fetch responses as text and then calls JSON.parse
    // manually, bypassing Response.prototype.json entirely. This catches
    // ALL JSON parsing on the page. We only clean objects that look like
    // YouTube player responses (have ad-related fields) to avoid performance
    // overhead on unrelated parsing.
    var origJsonParse = pageWindow.JSON.parse;
    pageWindow.JSON.parse = exportFunction(function() {
      var result = origJsonParse.apply(this, arguments);
      if (result && typeof result === 'object') {
        if (result.adPlacements || result.playerAds || result.adSlots ||
            result.playerResponse || result.enforcementData) {
          pageWindow.__ytCleanAds(result);
        }
      }
      return result;
    }, pageWindow);

    // ── Layer 2b: Override Response.prototype.json ─────────────────────────
    // Additional catch for fetch responses parsed via .json() method.
    var origRespJson = pageWindow.Response.prototype.json;
    pageWindow.Response.prototype.json = exportFunction(function() {
      var resp = this;
      var url = resp.url || '';
      return origRespJson.call(resp).then(exportFunction(function(data) {
        if (url.indexOf('/youtubei/v1/player') !== -1 ||
            url.indexOf('/youtubei/v1/next') !== -1) {
          if (pageWindow.__ytCleanAds) pageWindow.__ytCleanAds(data);
        }
        return data;
      }, pageWindow));
    }, pageWindow);

    // Store references for cleanup if the user toggles ad blocking off
    pageWindow.__ytAdStripCleanup = exportFunction(function() {
      pageWindow.JSON.parse = origJsonParse;
      pageWindow.Response.prototype.json = origRespJson;
      try {
        delete pageWindow.ytInitialPlayerResponse;
        if (_storedResponse) {
          pageWindow.ytInitialPlayerResponse = _storedResponse;
        }
      } catch(e) {}
      delete pageWindow.__ytCleanAds;
      delete pageWindow.__ytAdStripCleanup;
    }, pageWindow);
  }

  function uninstallAdDataStripping() {
    if (!adStripInstalled) return;
    adStripInstalled = false;
    try {
      var pageWindow = window.wrappedJSObject;
      if (pageWindow.__ytAdStripCleanup) {
        pageWindow.__ytAdStripCleanup();
      }
    } catch(e) {}
  }

  // ── Layer 3: Anti-adblock popup dismissal (safety net) ──────────────────
  // Periodically checks for YouTube's enforcement popups and dismisses them.
  // Uses a lightweight setInterval (every 3s) instead of a MutationObserver
  // to avoid performance overhead — YouTube's DOM is extremely active, and
  // enforcement popups are rare events that don't need instant detection.
  let dismissalInterval = null;

  function setupAntiAdblockDismissal() {
    if (dismissalInterval) return;

    dismissalInterval = setInterval(() => {
      if (!blockAdsActive) return;

      // Known enforcement popup selectors (YouTube updates these periodically)
      var selectors = [
        'ytd-enforcement-message-view-model',
        '#enforcement-message',
        'ytd-popup-container yt-playability-error-supported-renderers',
      ];

      for (var i = 0; i < selectors.length; i++) {
        try {
          var el = document.querySelector(selectors[i]);
          if (el) {
            // Try to close/dismiss it via known buttons
            var dismissBtn = el.querySelector(
              'button, [aria-label="Close"], .dismiss-button, #dismiss-button'
            );
            if (dismissBtn) {
              dismissBtn.click();
            } else {
              // No dismiss button found — hide the element
              el.style.display = 'none';
            }
          }
        } catch(e) {}
      }
    }, 3000);
  }

  // ── CRITICAL: Install ad data stripping IMMEDIATELY ──
  // Since blockAdsActive defaults to true and this script runs at
  // document_start, we must install the interceptions NOW — before YouTube's
  // code loads and sets ytInitialPlayerResponse.
  // If the async storage read later reveals the user disabled ad blocking,
  // uninstallAdDataStripping() will cleanly remove everything.
  // Wrapped in try-catch so a failure here does NOT crash the entire
  // extension (shorts blocker, posts blocker, etc. are defined in CSS).
  try {
    installAdDataStripping();
  } catch (e) {
    adStripInstalled = false;
  }

  // Anti-adblock popup dismissal needs a DOM target
  if (document.body) {
    setupAntiAdblockDismissal();
  } else {
    document.addEventListener('DOMContentLoaded', setupAntiAdblockDismissal);
  }

  // Run initialization
  initializeSettings();
})();
