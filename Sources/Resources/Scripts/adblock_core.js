/**
 * PureTube Core AdBlock Engine
 * Features:
 * 1. Defuser: Strips adPlacements, playerAds, adSlots from ytInitialPlayerResponse
 * 2. Network Interceptor: Purges ad data from InnerTube player API calls
 * 3. Video Fast-Forwarder: Auto-mutes and skips past any in-stream ads within milliseconds
 * 4. Dialog Dismissal: Automatically confirms "Continue watching?" prompts
 * 5. Telemetry: Notifies native Swift UI when ads are blocked
 */
(function() {
  'use strict';
  const host = window.location.hostname || '';
  if (!host.includes('youtube.com') && !host.includes('youtu.be')) return;
  if (window.__pureTubeAdBlockLoaded) return;
  window.__pureTubeAdBlockLoaded = true;

  console.log('[PureTube] Core AdBlock Engine Activated');

  function notifyNative(type, detail) {
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pureTubeAdBlock) {
        window.webkit.messageHandlers.pureTubeAdBlock.postMessage({
          type: type,
          detail: detail || '',
          timestamp: Date.now()
        });
      }
    } catch (e) {
      // Ignore if native handler is not registered yet
    }
  }

  // --- 1. Player Data Sanitizer (Defuser) ---
  function sanitizePlayerResponse(response) {
    if (!response || typeof response !== 'object') return response;
    let modified = false;

    try {
      if ('adPlacements' in response) {
        delete response.adPlacements;
        modified = true;
      }
      if ('playerAds' in response) {
        delete response.playerAds;
        modified = true;
      }
      if ('adSlots' in response) {
        delete response.adSlots;
        modified = true;
      }
      if ('adPlacementConfig' in response) {
        delete response.adPlacementConfig;
        modified = true;
      }
      if (response.playbackTracking) {
        delete response.playbackTracking.ptrackingUrl;
        delete response.playbackTracking.qoeUrl;
        delete response.playbackTracking.atrUrl;
        delete response.playbackTracking.videostatsPlaybackUrl;
        delete response.playbackTracking.videostatsDelayplayUrl;
        delete response.playbackTracking.videostatsWatchtimeUrl;
        modified = true;
      }
    } catch (e) {
      console.warn('[PureTube] Error in sanitizePlayerResponse:', e);
    }

    if (modified) {
      notifyNative('ad_defused', 'Purged ad config from player data');
    }
    return response;
  }

  // Hook JSON.parse to intercept all YouTube player JSON payloads
  const origJSONParse = JSON.parse;
  JSON.parse = function(...args) {
    const res = origJSONParse.apply(this, args);
    if (res && typeof res === 'object') {
      try {
        if (res.adPlacements || res.playerAds || res.adSlots || res.adPlacementConfig) {
          sanitizePlayerResponse(res);
        }
      } catch (e) {}
    }
    return res;
  };

  // Hook window.ytInitialPlayerResponse
  let internalPlayerResponse = window.ytInitialPlayerResponse;
  if (internalPlayerResponse) {
    internalPlayerResponse = sanitizePlayerResponse(internalPlayerResponse);
  }

  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    get: function() {
      return internalPlayerResponse;
    },
    set: function(newVal) {
      internalPlayerResponse = sanitizePlayerResponse(newVal);
    },
    configurable: true
  });

  // --- 2. Network Interceptors (XHR & Fetch) ---
  const isAdUrl = function(url) {
    if (!url || typeof url !== 'string') return false;
    return (
      url.includes('/pagead/') ||
      url.includes('/api/stats/ads') ||
      url.includes('/ptracking') ||
      url.includes('doubleclick.net') ||
      url.includes('googlesyndication.com') ||
      url.includes('googleads.g.doubleclick.net')
    );
  };

  // Hook XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._pureTubeUrl = typeof url === 'string' ? url : (url && url.toString ? url.toString() : '');
    if (isAdUrl(this._pureTubeUrl)) {
      this.abort();
      notifyNative('ad_request_blocked', this._pureTubeUrl);
      return;
    }
    return origOpen.apply(this, arguments);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('readystatechange', function() {
      if (this.readyState === 4 && this._pureTubeUrl && this._pureTubeUrl.includes('/youtubei/v1/player')) {
        try {
          const data = origJSONParse.call(JSON, this.responseText);
          const sanitized = sanitizePlayerResponse(data);
          const newText = JSON.stringify(sanitized);
          Object.defineProperty(this, 'responseText', { value: newText, configurable: true });
          Object.defineProperty(this, 'response', { value: newText, configurable: true });
        } catch (e) {}
      }
    });
    return origSend.apply(this, args);
  };

  // Hook window.fetch
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    
    if (isAdUrl(url)) {
      notifyNative('ad_request_blocked', url);
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await origFetch.apply(this, args);

    // If InnerTube player response is requested dynamically via fetch
    if (url.includes('/youtubei/v1/player')) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        const sanitized = sanitizePlayerResponse(json);
        return new Response(JSON.stringify(sanitized), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (err) {
        return response;
      }
    }

    return response;
  };

  // --- 3. Auto-Fast-Forwarder & Skip Button Clicker ---
  let lastSkipTime = 0;

  function fastForwardAndSkip() {
    const now = Date.now();
    const moviePlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    const video = document.querySelector('video');

    // 1. Direct Skip Button Click (click instantly regardless of state!)
    const skipSelectors = [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button-text',
      '.videoAdUiSkipButton',
      'button.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-slot button',
      '.ytp-ad-skip-button-container button',
      '[id^="skip-button:"]',
      '[id^="skip-button"]',
      'button[aria-label*="skip" i]',
      'button[aria-label*="跳过" i]',
      'button[aria-label*="略過" i]'
    ];

    for (const selector of skipSelectors) {
      const btn = document.querySelector(selector);
      if (btn) {
        try {
          btn.click();
          if (now - lastSkipTime > 800) {
            lastSkipTime = now;
            notifyNative('ad_skipped', 'Clicked skip button');
          }
        } catch (e) {}
      }
    }

    // 2. Comprehensive Ad Detection (Multiple Signals)
    const isAdActive = (
      (moviePlayer && (
        moviePlayer.classList.contains('ad-showing') ||
        moviePlayer.classList.contains('ad-interrupting') ||
        (typeof moviePlayer.isAd === 'function' && moviePlayer.isAd()) ||
        (typeof moviePlayer.getAdState === 'function' && moviePlayer.getAdState() > 0)
      )) ||
      document.querySelector('.ytp-ad-player-overlay') !== null ||
      document.querySelector('.ytp-ad-text') !== null ||
      document.querySelector('.ytp-ad-badge') !== null ||
      document.querySelector('[class*="badge-sponsored"]') !== null ||
      document.querySelector('.video-ads.ytp-ad-module')?.children.length > 0
    );

    // 3. Fast-forward & mute video if an ad is currently playing
    if (isAdActive) {
      if (moviePlayer && typeof moviePlayer.skipAd === 'function') {
        try { moviePlayer.skipAd(); } catch (e) {}
      }

      if (video) {
        try {
          video.muted = true;
          video.playbackRate = 16.0;
          if (isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration;
          } else {
            video.currentTime = 999999;
          }
          if (now - lastSkipTime > 800) {
            lastSkipTime = now;
            notifyNative('ad_skipped', 'Fast-forwarded active ad stream');
          }
        } catch (e) {}
      }
    }

    // 4. Auto-dismiss "Video paused. Continue watching?"
    const dialogConfirm = document.querySelector(
      'yt-confirm-dialog-renderer #confirm-button, #confirm-button button'
    );
    if (dialogConfirm) {
      try {
        dialogConfirm.click();
      } catch (e) {}
    }
  }

  // --- 4. Anti-App Redirection & Smart Banner Purger ---
  function purgeAppHandoffs() {
    // Remove Apple Smart App Banners
    document.querySelectorAll('meta[name="apple-itunes-app"]').forEach(el => el.remove());

    // Remove YouTube "Open in App" promotions and dialogs
    const appSelectors = [
      'yt-mealbar-promo-renderer',
      'ytd-app-promo-renderer',
      'ytm-app-promo',
      'ytm-open-app-button',
      '.fullscreen-and-theater-app-promo',
      'a[href^="vnd.youtube"]',
      'a[href^="youtube:"]'
    ];
    document.querySelectorAll(appSelectors.join(',')).forEach(el => {
      try { el.remove(); } catch (e) {}
    });
  }

  purgeAppHandoffs();
  setInterval(purgeAppHandoffs, 1000);

  // Hook window.open to prevent JS opening custom app schemes
  const origWindowOpen = window.open;
  window.open = function(url, target, features) {
    if (typeof url === 'string') {
      if (url.startsWith('vnd.youtube') || url.startsWith('youtube:') || url.startsWith('intent:')) {
        console.log('[PureTube] Prevented window.open to external app:', url);
        return null;
      }
    }
    return origWindowOpen.apply(this, arguments);
  };

  // --- 5. Clean Empty Ad Slots & Reflow Grid ---
  function removeEmptyAdGridSlots() {
    // 1. Direct removal of parent grid cards that host ad components
    const adCardSelectors = [
      'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
      'ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer)',
      'ytd-rich-item-renderer:has(ad-slot-renderer)',
      'ytd-rich-item-renderer:has(ytd-display-ad-renderer)',
      'ytd-rich-item-renderer:has(ytd-promoted-video-renderer)',
      'ytd-rich-item-renderer:has(ytd-promoted-sparkles-web-renderer)',
      'ytd-rich-item-renderer:has(#ad)',
      'ytd-rich-item-renderer:has(.ytd-ad-slot-renderer)',
      'ytd-rich-section-renderer:has(ytd-ad-slot-renderer)',
      'ytd-rich-section-renderer:has(ytd-statement-banner-renderer)',
      'ytd-ad-slot-renderer',
      '#masthead-ad'
    ];

    try {
      const adCards = document.querySelectorAll(adCardSelectors.join(','));
      adCards.forEach(card => card.remove());
    } catch (e) {}

    // 2. Scan all rich items to purge empty ghost placeholders
    const allItems = document.querySelectorAll('ytd-rich-item-renderer');
    allItems.forEach(item => {
      if (item.querySelector('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-promoted-video-renderer, ytd-display-ad-renderer, #ad')) {
        item.remove();
        return;
      }
      const content = item.querySelector('#content');
      if (content) {
        const hasMedia = content.querySelector('ytd-rich-grid-media, ytd-video-renderer, ytd-playlist-renderer, ytd-radio-renderer, ytd-reel-item-renderer, ytd-post-renderer');
        if (!hasMedia && content.children.length === 0) {
          item.remove();
        }
      }
    });
  }

  // High-frequency interval check (100ms) for instant skipping
  setInterval(() => {
    fastForwardAndSkip();
    removeEmptyAdGridSlots();
  }, 100);

  // Hook playback events directly on the document for immediate reaction
  document.addEventListener('timeupdate', fastForwardAndSkip, true);
  document.addEventListener('play', fastForwardAndSkip, true);
  document.addEventListener('playing', fastForwardAndSkip, true);

  // MutationObserver for instant trigger on DOM change
  const observer = new MutationObserver(() => {
    fastForwardAndSkip();
    removeEmptyAdGridSlots();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }
})();
