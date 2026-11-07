/**
 * PureTube Background Playback & PiP Enabler
 */
(function() {
  'use strict';
  const host = window.location.hostname || '';
  if (!host.includes('youtube.com') && !host.includes('youtu.be')) return;
  if (window.__pureTubeBgLoaded) return;
  window.__pureTubeBgLoaded = true;

  console.log('[PureTube] Background Playback Enabler Activated');

  // 1. Spoof visibility properties
  try {
    Object.defineProperty(document, 'hidden', {
      get: () => false,
      configurable: true
    });
    Object.defineProperty(document, 'visibilityState', {
      get: () => 'visible',
      configurable: true
    });
    Object.defineProperty(document, 'webkitHidden', {
      get: () => false,
      configurable: true
    });
    Object.defineProperty(document, 'webkitVisibilityState', {
      get: () => 'visible',
      configurable: true
    });
  } catch (err) {
    console.warn('[PureTube] Failed to spoof visibility:', err);
  }

  // 2. Intercept pause events
  const pausedEvents = ['visibilitychange', 'webkitvisibilitychange', 'blur', 'pagehide'];
  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (pausedEvents.includes(type)) {
      // Do not allow YouTube to pause when backgrounded
      return;
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  // 3. Patch video elements for inline & PiP playback
  function patchVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (!video.hasAttribute('playsinline')) {
        video.setAttribute('playsinline', '');
      }
      if (!video.hasAttribute('webkit-playsinline')) {
        video.setAttribute('webkit-playsinline', '');
      }
      video.removeAttribute('disablepictureinpicture');
      video.removeAttribute('disableremoteplayback');
    });
  }

  // Initial patch and interval observer
  patchVideos();
  setInterval(patchVideos, 1500);

  // 4. Exposed Helper Functions for Native App
  window.__pureTubeRequestPiP = function() {
    const video = document.querySelector('video');
    if (!video) return false;

    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
      return true;
    } else if (video.requestPictureInPicture) {
      video.requestPictureInPicture().catch(e => {
        console.warn('[PureTube] PiP failed:', e);
      });
      return true;
    } else if (video.webkitSetPresentationMode) {
      video.webkitSetPresentationMode('picture-in-picture');
      return true;
    }
    return false;
  };

  window.__pureTubeTogglePlay = function() {
    const video = document.querySelector('video');
    if (video) {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }
  };

  window.__pureTubeSeek = function(deltaSeconds) {
    const video = document.querySelector('video');
    if (video && isFinite(video.currentTime)) {
      video.currentTime = Math.max(0, video.currentTime + deltaSeconds);
    }
  };

  // 5. Native iPad Fullscreen Controller
  window.__pureTubeEnterFullscreen = function() {
    const video = document.querySelector('video');
    if (!video) return false;

    if (video.webkitDisplayingFullscreen) {
      if (video.webkitSetPresentationMode) {
        video.webkitSetPresentationMode('inline');
      }
      return true;
    }

    if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return true;
    } else if (video.webkitSetPresentationMode) {
      video.webkitSetPresentationMode('fullscreen');
      return true;
    }
    return false;
  };

  // 6. Polyfill Fullscreen API for YouTube Desktop Layout on iPad
  const enterFS = function(el) {
    const video = (el && el.tagName === 'VIDEO') ? el : (el ? el.querySelector('video') : null) || document.querySelector('video');
    if (video) {
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else if (video.webkitSetPresentationMode) {
        video.webkitSetPresentationMode('fullscreen');
      }
    }
  };

  Element.prototype.requestFullscreen = function() {
    enterFS(this);
    return Promise.resolve();
  };
  Element.prototype.webkitRequestFullscreen = function() {
    enterFS(this);
    return Promise.resolve();
  };
  Element.prototype.webkitRequestFullScreen = function() {
    enterFS(this);
    return Promise.resolve();
  };

  document.exitFullscreen = function() {
    const video = document.querySelector('video');
    if (video && video.webkitSetPresentationMode) {
      video.webkitSetPresentationMode('inline');
    }
    return Promise.resolve();
  };

  try {
    Object.defineProperty(document, 'fullscreenEnabled', { get: () => true, configurable: true });
    Object.defineProperty(document, 'webkitFullscreenEnabled', { get: () => true, configurable: true });
  } catch(e) {}

  // Intercept click on YouTube player's fullscreen button (.ytp-fullscreen-button)
  document.addEventListener('click', function(e) {
    const fsBtn = e.target && e.target.closest ? e.target.closest('.ytp-fullscreen-button') : null;
    if (fsBtn) {
      e.preventDefault();
      e.stopPropagation();
      window.__pureTubeEnterFullscreen();
    }
  }, true);

  // Keyboard 'f' key for fullscreen
  document.addEventListener('keydown', function(e) {
    if (e.key === 'f' || e.key === 'F') {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        window.__pureTubeEnterFullscreen();
      }
    }
  }, true);
})();
