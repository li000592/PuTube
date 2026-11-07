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
      if (response.adPlacements && response.adPlacements.length > 0) {
        response.adPlacements = [];
        modified = true;
      }
      if (response.playerAds && response.playerAds.length > 0) {
        response.playerAds = [];
        modified = true;
      }
      if (response.adSlots && response.adSlots.length > 0) {
        response.adSlots = [];
        modified = true;
      }
      if (response.adPlacementConfig) {
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
      }
    } catch (e) {
      console.warn('[PureTube] Error in sanitizePlayerResponse:', e);
    }

    if (modified) {
      notifyNative('ad_defused', 'Purged ad config from player data');
    }
    return response;
  }

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
    if (isAdUrl(url)) {
      this.abort();
      notifyNative('ad_request_blocked', url);
      return;
    }
    return origOpen.apply(this, arguments);
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
    // In YouTube's player, an ad is ONLY actively showing when the player element has 'ad-showing' or 'ad-interrupting'
    const player = document.querySelector('#movie_player, .html5-video-player');
    const isAdActive = player && (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting')
    );
    const video = document.querySelector('video');

    if (isAdActive && video) {
      try {
        video.muted = true;
        if (isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration;
        }
        if (now - lastSkipTime > 1000) {
          lastSkipTime = now;
          notifyNative('ad_skipped', 'Fast-forwarded active ad stream');
        }
      } catch (e) {}
    }

    // Only click skip buttons when an ad is actually active
    if (isAdActive) {
      const skipSelectors = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button-text',
        '.videoAdUiSkipButton',
        'button.ytp-ad-skip-button-modern'
      ];

      for (const selector of skipSelectors) {
        const btn = document.querySelector(selector);
        if (btn) {
          try {
            btn.click();
            if (now - lastSkipTime > 1000) {
              lastSkipTime = now;
              notifyNative('ad_skipped', 'Clicked skip button');
            }
          } catch (e) {}
        }
      }
    }

    // Auto-dismiss "Video paused. Continue watching?"
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

  // Fast interval check for rapid skipping and grid cleanup
  setInterval(() => {
    fastForwardAndSkip();
    removeEmptyAdGridSlots();
  }, 250);

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
