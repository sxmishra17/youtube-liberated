/**
 * ============================================================================
 * YouTube Liberated — Content Script Logic
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
   * has been minimized. Without this, YouTube pauses the video when the page
   * becomes hidden (its way of enforcing YouTube Premium for background play).
   *
   * When enabled, this:
   * 1. Overrides document.hidden → always returns false
   * 2. Overrides document.visibilityState → always returns "visible"
   * 3. Blocks visibilitychange events from reaching YouTube's listeners
   *
   * This is the same technique used by "Video Background Play Fix" and similar
   * extensions. Works on Firefox Android (Fenix) and Firefox Desktop.
   */
  let bgPlaybackInstalled = false;
  const originalAddEventListener = EventTarget.prototype.addEventListener;

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

    // Override document.hidden to always return false
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: function() { return false; }
    });

    // Override document.visibilityState to always return "visible"
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: function() { return 'visible'; }
    });

    // Intercept addEventListener to block visibilitychange listeners
    // from being registered by YouTube's code
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'visibilitychange') {
        // Silently drop visibilitychange listeners — YouTube will never
        // know the page lost visibility
        return;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
  }

  function disableBackgroundPlayback() {
    if (!bgPlaybackInstalled) return;
    bgPlaybackInstalled = false;

    // Restore original addEventListener
    EventTarget.prototype.addEventListener = originalAddEventListener;

    // Restore document.hidden and visibilityState to their native behavior
    // by deleting our overrides (the native getters on the prototype will
    // take over again)
    delete document.hidden;
    delete document.visibilityState;
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
