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
 * 4. Run a MutationObserver to auto-skip video ads (pre-roll, mid-roll).
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
   * ── 3. AGGRESSIVE AD SKIPPER & FAST-FORWARDER ──────────────────────────────
   * Handles interactive/video ads that CSS alone cannot completely stop.
   * Uses multiple detection layers to skip ads as close to instantly as possible:
   *   Layer 1: CSS injection to visually hide the player during ads (zero flash)
   *   Layer 2: MutationObserver (synchronous, no debounce) on class changes
   *   Layer 3: Fast polling interval (every 50ms) as a safety net
   *   Layer 4: Video element event interception (playing/timeupdate)
   */

  // ── Layer 1: Inject CSS to visually hide the player while an ad is active ──
  // This prevents the user from ever seeing ad frames, even if JS takes a tick
  // to seek/skip. The player is revealed again once the ad state is removed.
  const adHideStyle = document.createElement('style');
  adHideStyle.id = 'yt-ext-ad-hide';
  adHideStyle.textContent = `
    html.yt-block-ads .html5-video-player.ad-showing video,
    html.yt-block-ads .html5-video-player.ad-interrupting video {
      opacity: 0 !important;
    }
    html.yt-block-ads .html5-video-player.ad-showing .ytp-ad-player-overlay-layout,
    html.yt-block-ads .html5-video-player.ad-interrupting .ytp-ad-player-overlay-layout {
      display: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(adHideStyle);

  // ── Core skip logic ────────────────────────────────────────────────────────
  function skipVideoAds() {
    if (!blockAdsActive) return;

    // Check if the player is currently in an ad state
    const playerContainer = document.querySelector('.html5-video-player');
    const isAdShowing = playerContainer && (
      playerContainer.classList.contains('ad-showing') ||
      playerContainer.classList.contains('ad-interrupting')
    );

    if (isAdShowing) {
      // Mute, fast-forward, and seek to end of every ad video element
      const videos = document.querySelectorAll('video');
      videos.forEach((video) => {
        // Mute immediately — even before duration is known
        video.muted = true;
        video.volume = 0;

        if (!isNaN(video.duration) && video.duration > 0) {
          // Set speed to maximum and seek to the end
          video.playbackRate = 16;
          video.currentTime = video.duration;
        }
      });
    }

    // Auto-click all known skip button selectors
    const skipSelectors = [
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-text',
      '.ytp-ad-skip-button-hover',
      // "Skip Ads" overlay text button used in newer YouTube layouts
      'button.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-slot',
      // "Visit advertiser" close/dismiss buttons
      '.ytp-ad-overlay-close-button'
    ];

    for (const selector of skipSelectors) {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.click();
      }
    }
  }

  // ── Layer 2: MutationObserver — synchronous, no debounce ───────────────────
  // Fires skipVideoAds() on every DOM mutation with zero delay.
  // We use a targeted observer on the player container when available,
  // and a broader document observer as fallback.
  let playerObserver = null;

  function observePlayerContainer() {
    const player = document.querySelector('.html5-video-player');
    if (!player || player.__ytExtObserved) return;

    player.__ytExtObserved = true;

    // Watch specifically for class attribute changes on the player (ad-showing toggled)
    playerObserver = new MutationObserver(() => {
      skipVideoAds();
    });
    playerObserver.observe(player, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // Broad observer: watches for new child nodes (catches the player appearing)
  const broadObserver = new MutationObserver(() => {
    skipVideoAds();
    // Try to attach the targeted player observer if not yet attached
    observePlayerContainer();
  });

  // ── Layer 3: Fast polling interval ─────────────────────────────────────────
  // Runs every 50ms as a safety net to catch anything the observers miss.
  let adPollInterval = null;

  function startAdPolling() {
    if (adPollInterval) return;
    adPollInterval = setInterval(skipVideoAds, 50);
  }

  function stopAdPolling() {
    if (adPollInterval) {
      clearInterval(adPollInterval);
      adPollInterval = null;
    }
  }

  // ── Layer 4: Video element event interception ──────────────────────────────
  // Hooks into video elements to catch the exact moment an ad starts playing.
  const hookedVideos = new WeakSet();

  function hookVideoElements() {
    if (!blockAdsActive) return;

    document.querySelectorAll('video').forEach((video) => {
      if (hookedVideos.has(video)) return;
      hookedVideos.add(video);

      // 'playing' fires the instant the video starts rendering frames
      video.addEventListener('playing', () => {
        const player = video.closest('.html5-video-player');
        if (player && (
          player.classList.contains('ad-showing') ||
          player.classList.contains('ad-interrupting')
        )) {
          video.muted = true;
          video.volume = 0;
          if (!isNaN(video.duration) && video.duration > 0) {
            video.playbackRate = 16;
            video.currentTime = video.duration;
          }
        }
      });

      // 'timeupdate' fires as the ad progresses — secondary catch
      video.addEventListener('timeupdate', () => {
        const player = video.closest('.html5-video-player');
        if (player && (
          player.classList.contains('ad-showing') ||
          player.classList.contains('ad-interrupting')
        )) {
          video.muted = true;
          video.volume = 0;
          if (!isNaN(video.duration) && video.duration > 0) {
            video.playbackRate = 16;
            video.currentTime = video.duration;
          }
        }
      });

      // 'loadedmetadata' fires when duration becomes known — earliest skip opportunity
      video.addEventListener('loadedmetadata', () => {
        const player = video.closest('.html5-video-player');
        if (player && (
          player.classList.contains('ad-showing') ||
          player.classList.contains('ad-interrupting')
        )) {
          video.muted = true;
          video.volume = 0;
          video.playbackRate = 16;
          video.currentTime = video.duration;
        }
      });
    });
  }

  // ── Start all detection layers ─────────────────────────────────────────────
  function startAdBlocker() {
    // Layer 2: Broad DOM observer
    broadObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Try to attach the targeted player observer immediately
    observePlayerContainer();

    // Layer 3: Fast polling
    startAdPolling();

    // Layer 4: Hook existing video elements
    hookVideoElements();

    // Re-hook video elements periodically (new ones may be created by YouTube SPA)
    setInterval(hookVideoElements, 500);

    // Initial sweep
    skipVideoAds();
  }

  if (document.body) {
    startAdBlocker();
  } else {
    document.addEventListener('DOMContentLoaded', startAdBlocker);
  }

  // Run initialization
  initializeSettings();
})();
