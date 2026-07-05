/**
 * ============================================================================
 * YouTube Liberated — Popup Logic
 * Copyright (c) 2026 Yuvatech Solutions USA LLC & Satish Mishra. All rights reserved.
 * ============================================================================
 *
 * This file handles reading/writing settings from browser storage and updating
 * the popup UI state accordingly.
 *
 * It supports standard WebExtension API namespaces (`browser` and `chrome`).
 *
 * ── HOW TO USE ──────────────────────────────────────────────────────────────
 * 1. Load the extension in Firefox via about:debugging → This Firefox →
 *    Load Temporary Add-on → select manifest.json
 * 2. Click the shield icon (🛡️) in the toolbar to open this popup
 * 3. Toggle "Block Ads" ON/OFF to control YouTube ad blocking
 * 4. Toggle "Block Shorts" ON/OFF to control YouTube Shorts hiding
 * 5. Toggle "Block Posts" ON/OFF to control YouTube Community Posts hiding
 * 6. Settings persist across browser sessions automatically
 * ============================================================================
 */

// Cross-browser support for Chrome/Firefox storage API
const storage = (typeof browser !== 'undefined' && browser.storage) 
  ? browser.storage.local 
  : chrome.storage.local;

// Helper to update the visual state (ON/OFF labels and row active colors)
function updateUIState(checkboxId, isChecked) {
  const checkbox = document.getElementById(checkboxId);
  if (!checkbox) return;
  
  checkbox.checked = isChecked;
  
  // Find parent toggle-row card to toggle the active color class
  const row = checkbox.closest('.toggle-row');
  if (row) {
    if (isChecked) {
      row.classList.add('active');
    } else {
      row.classList.remove('active');
    }
  }

  // Update text label (e.g. "ads-status" -> "ON" or "OFF")
  const statusLabel = document.getElementById(checkboxId.replace('-toggle', '-status'));
  if (statusLabel) {
    statusLabel.textContent = isChecked ? 'ON' : 'OFF';
  }
}

// Loads saved configurations or applies defaults (all true by default)
function loadSettings() {
  const defaultSettings = {
    blockAds: true,
    blockShorts: true,
    blockPosts: true,
    bgPlayback: true
  };

  storage.get(defaultSettings, (items) => {
    // If runtime error occurs or items are undefined, fall back to defaults
    const blockAdsVal = (items && items.blockAds !== undefined) ? items.blockAds : true;
    const blockShortsVal = (items && items.blockShorts !== undefined) ? items.blockShorts : true;
    const blockPostsVal = (items && items.blockPosts !== undefined) ? items.blockPosts : true;
    const bgPlaybackVal = (items && items.bgPlayback !== undefined) ? items.bgPlayback : true;

    updateUIState('ads-toggle', blockAdsVal);
    updateUIState('shorts-toggle', blockShortsVal);
    updateUIState('posts-toggle', blockPostsVal);
    updateUIState('bg-toggle', bgPlaybackVal);
  });
}

// Saves a specific setting to browser storage when user flips a switch
function saveSetting(settingName, value, checkboxId) {
  const data = {};
  data[settingName] = value;
  
  storage.set(data, () => {
    // Visual feedback update
    updateUIState(checkboxId, value);
  });
}

// Setup event listeners once DOM content is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Load initial settings
  loadSettings();

  // Listen for changes on the Ads toggle switch
  const adsToggle = document.getElementById('ads-toggle');
  if (adsToggle) {
    adsToggle.addEventListener('change', (event) => {
      saveSetting('blockAds', event.target.checked, 'ads-toggle');
    });
  }

  // Listen for changes on the Shorts toggle switch
  const shortsToggle = document.getElementById('shorts-toggle');
  if (shortsToggle) {
    shortsToggle.addEventListener('change', (event) => {
      saveSetting('blockShorts', event.target.checked, 'shorts-toggle');
    });
  }

  // Listen for changes on the Posts toggle switch
  const postsToggle = document.getElementById('posts-toggle');
  if (postsToggle) {
    postsToggle.addEventListener('change', (event) => {
      saveSetting('blockPosts', event.target.checked, 'posts-toggle');
    });
  }

  // Listen for changes on the Background Play toggle switch
  const bgToggle = document.getElementById('bg-toggle');
  if (bgToggle) {
    bgToggle.addEventListener('change', (event) => {
      saveSetting('bgPlayback', event.target.checked, 'bg-toggle');
    });
  }
});
