/**
 * ============================================================================
 * YouTube Liberated — Inject Script (MAIN world execution)
 * Copyright (c) 2026 Yuvatech Solutions USA LLC & Satish Mishra. All rights reserved.
 * ============================================================================
 *
 * This script is injected directly into YouTube's page context (MAIN world).
 * Because standard content scripts in Manifest V3 run in an isolated world,
 * modifying global APIs (like the Page Visibility API) only affects the
 * isolated world and not YouTube's page scripts.
 *
 * This inject script bridges that gap by running in the MAIN world to:
 * 1. Override document.hidden to always return false (when active).
 * 2. Override document.visibilityState to always return "visible" (when active).
 * 3. Intercept and bypass YouTube's visibilitychange listeners (when active).
 *
 * It reads the state of background playback from a custom dataset attribute
 * on the <html> tag, which is synchronized by the isolated world content.js.
 *
 * ── HOW TO USE THIS EXTENSION ───────────────────────────────────────────────
 * 1. Open Chrome and navigate to "chrome://extensions/".
 * 2. Toggle "Developer mode" in the top-right corner.
 * 3. Click "Load unpacked" in the top-left corner.
 * 4. Select the Chrome extension folder containing manifest.json.
 * ============================================================================
 */

(function () {
  'use strict';

  // Keep a reference to original event listener APIs to allow normal operations
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

  /**
   * Check if background playback block is active by reading the HTML attribute
   * set by our isolated-world content script.
   */
  function isBgPlaybackActive() {
    const root = document.documentElement;
    return root && root.dataset.bgPlaybackActive === 'true';
  }

  // Intercept addEventListener to manage visibilitychange event listeners
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (type === 'visibilitychange') {
      // Create a wrapper function that checks at runtime if the background playback is active.
      // If it is active, we bypass/suppress the visibility change callback.
      const wrappedListener = function (event) {
        if (isBgPlaybackActive()) {
          // Suppress the event callback so YouTube does not know the tab is hidden
          return;
        }
        return listener.apply(this, arguments);
      };

      // Store a mapping to allow removeEventListener to find the wrapper
      this._visibilityListeners = this._visibilityListeners || new Map();
      this._visibilityListeners.set(listener, wrappedListener);

      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // Intercept removeEventListener so YouTube can unregister listeners correctly
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    if (type === 'visibilitychange' && this._visibilityListeners) {
      const wrapped = this._visibilityListeners.get(listener);
      if (wrapped) {
        this._visibilityListeners.delete(listener);
        return originalRemoveEventListener.call(this, type, wrapped, options);
      }
    }
    return originalRemoveEventListener.call(this, type, listener, options);
  };

  // Override document.hidden getter
  const origHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden') ||
                     Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'hidden');

  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: function () {
      if (isBgPlaybackActive()) {
        return false;
      }
      return origHidden ? origHidden.get.call(document) : false;
    }
  });

  // Override document.visibilityState getter
  const origVisibilityState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState') ||
                               Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'visibilityState');

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: function () {
      if (isBgPlaybackActive()) {
        return 'visible';
      }
      return origVisibilityState ? origVisibilityState.get.call(document) : 'visible';
    }
  });
})();
