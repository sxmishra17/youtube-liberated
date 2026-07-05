/**
 * ============================================================================
 * YouTube Liberated — Popup Logic (Chrome MV3)
 * Copyright (c) 2026 Yuvatech Solutions USA LLC & Satish Mishra. All rights reserved.
 * ============================================================================
 *
 * This file handles reading/writing settings from Chrome storage and updating
 * the popup UI state accordingly.
 *
 * It uses the standard Manifest V3 `chrome.storage.local` API.
 *
 * ── HOW TO USE ──────────────────────────────────────────────────────────────
 * 1. Load the extension in Chrome via chrome://extensions/ -> Enable Developer
 *    Mode -> Load unpacked -> select the extension directory
 * 2. Click the YouTube Liberated icon in the toolbar to open this popup
 * 3. Toggle settings ON/OFF to control YouTube features:
 *    - Block Ads (toggles ad block CSS & JS)
 *    - Block Shorts (toggles Shorts CSS & redirects /shorts/ URLs)
 *    - Block Posts (toggles Community Posts CSS)
 *    - Background Play (keeps audio when page visibility changes)
 * 4. Settings persist across browser sessions automatically
 * ============================================================================
 */

// Use Chrome local storage API
const storage = chrome.storage.local;

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
    blockGames: true,
    bgPlayback: true
  };

  storage.get(defaultSettings, (items) => {
    // If items are undefined, fall back to defaults
    const blockAdsVal = (items && items.blockAds !== undefined) ? items.blockAds : true;
    const blockShortsVal = (items && items.blockShorts !== undefined) ? items.blockShorts : true;
    const blockPostsVal = (items && items.blockPosts !== undefined) ? items.blockPosts : true;
    const blockGamesVal = (items && items.blockGames !== undefined) ? items.blockGames : true;
    const bgPlaybackVal = (items && items.bgPlayback !== undefined) ? items.bgPlayback : true;

    updateUIState('ads-toggle', blockAdsVal);
    updateUIState('shorts-toggle', blockShortsVal);
    updateUIState('posts-toggle', blockPostsVal);
    updateUIState('games-toggle', blockGamesVal);
    updateUIState('bg-toggle', bgPlaybackVal);
  });
}

// Saves a specific setting to Chrome storage when user flips a switch
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

  // Listen for changes on the Games toggle switch
  const gamesToggle = document.getElementById('games-toggle');
  if (gamesToggle) {
    gamesToggle.addEventListener('change', (event) => {
      saveSetting('blockGames', event.target.checked, 'games-toggle');
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
