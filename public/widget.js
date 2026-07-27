(function () {
  if (window.__LIVEDESK_LOADED__) return;
  window.__LIVEDESK_LOADED__ = true;

  var script =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  var company = script && script.getAttribute('data-company');
  if (!company) {
    console.error('[LiveDesk] Missing data-company attribute on widget.js');
    return;
  }

  var src = script && script.src ? script.src : '';
  var origin = src
    ? src.replace(/\/widget\.js(?:\?.*)?$/, '')
    : window.location.origin;
  var widgetUrl = origin + '/w/' + encodeURIComponent(company);
  var statusUrl = origin + '/api/status/' + encodeURIComponent(company);
  var brandColor = '#0f766e';
  var status = {
    online: false,
    onlineCount: 0,
    liveFeedActive: false,
    name: '',
    brandColor: brandColor,
  };
  var statusListeners = [];

  var style = document.createElement('style');
  style.textContent =
    '#livedesk-root{all:initial;font-family:system-ui,-apple-system,sans-serif}' +
    '#livedesk-root *{box-sizing:border-box}' +
    '#livedesk-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;border-radius:999px;padding:14px 20px;color:#fff;font:600 14px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(15,23,42,.25);display:inline-flex;align-items:center;gap:8px;transition:background .2s ease,opacity .2s ease}' +
    '#livedesk-btn:hover{filter:brightness(1.05)}' +
    '#livedesk-btn.offline{opacity:.92}' +
    '#livedesk-dot{width:8px;height:8px;border-radius:999px;background:#94a3b8;flex-shrink:0}' +
    '#livedesk-btn.online #livedesk-dot{background:#4ade80;box-shadow:0 0 0 3px rgba(74,222,128,.35)}' +
    '#livedesk-backdrop{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.45);display:none;align-items:flex-end;justify-content:flex-end;padding:16px}' +
    '#livedesk-backdrop.open{display:flex}' +
    '#livedesk-panel{width:min(420px,100%);height:min(720px,calc(100vh - 32px));background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 25px 60px rgba(15,23,42,.35);position:relative;isolation:isolate}' +
    '@media (min-width:900px){#livedesk-panel{width:min(980px,calc(100vw - 32px));height:min(720px,calc(100vh - 32px))}}' +
    '#livedesk-close{position:absolute;top:10px;right:10px;z-index:2;border:0;background:rgba(15,23,42,.08);width:32px;height:32px;border-radius:999px;cursor:pointer;font-size:18px;line-height:1}' +
    '#livedesk-frame{width:100%;height:100%;border:0;display:block;position:relative;z-index:1}';
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.id = 'livedesk-root';

  var button = document.createElement('button');
  button.id = 'livedesk-btn';
  button.type = 'button';
  button.setAttribute('aria-label', 'Talk to us on video');
  button.style.background = brandColor;
  button.innerHTML =
    '<span id="livedesk-dot" aria-hidden="true"></span><span id="livedesk-btn-label">Talk to us</span>';

  var label = null;
  function getLabel() {
    if (!label) label = button.querySelector('#livedesk-btn-label');
    return label;
  }

  var backdrop = document.createElement('div');
  backdrop.id = 'livedesk-backdrop';

  var panel = document.createElement('div');
  panel.id = 'livedesk-panel';

  var close = document.createElement('button');
  close.id = 'livedesk-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = '&times;';

  var iframe = document.createElement('iframe');
  iframe.id = 'livedesk-frame';
  iframe.title = 'LiveDesk video widget';
  iframe.allow = 'camera; microphone; autoplay; display-capture';
  iframe.src = widgetUrl;

  panel.appendChild(close);
  panel.appendChild(iframe);
  backdrop.appendChild(panel);
  root.appendChild(button);
  root.appendChild(backdrop);
  document.body.appendChild(root);

  function open() {
    backdrop.classList.add('open');
  }
  function closePanel() {
    backdrop.classList.remove('open');
  }

  function emitStatus() {
    var detail = {
      company: company,
      online: status.online,
      onlineCount: status.onlineCount,
      liveFeedActive: status.liveFeedActive,
      name: status.name,
      brandColor: status.brandColor,
    };
    window.LiveDesk = window.LiveDesk || {};
    window.LiveDesk.status = detail;
    for (var i = 0; i < statusListeners.length; i++) {
      try {
        statusListeners[i](detail);
      } catch (err) {
        console.error('[LiveDesk] status listener error', err);
      }
    }
    try {
      document.dispatchEvent(
        new CustomEvent('livedesk:status', { detail: detail })
      );
    } catch (e) {
      // older browsers
    }
  }

  function applyStatus(next) {
    status = {
      online: !!next.online,
      onlineCount: next.onlineCount || 0,
      liveFeedActive: !!next.liveFeedActive,
      name: next.name || '',
      brandColor: next.brandColor || brandColor,
    };
    brandColor = status.brandColor;
    button.style.background = brandColor;
    button.classList.toggle('online', status.online);
    button.classList.toggle('offline', !status.online);
    var el = getLabel();
    if (el) {
      el.textContent = status.online ? "We're online" : 'Leave a message';
    }
    button.setAttribute(
      'aria-label',
      status.online
        ? 'Talk live — a representative is online'
        : 'Leave a message — no one is online right now'
    );
    emitStatus();
  }

  function refreshStatus() {
    fetch(statusUrl, { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('status ' + res.status);
        return res.json();
      })
      .then(applyStatus)
      .catch(function () {
        // Keep last known status; button still works.
      });
  }

  button.addEventListener('click', open);
  close.addEventListener('click', closePanel);
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) closePanel();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refreshStatus();
  });

  window.LiveDesk = {
    company: company,
    origin: origin,
    status: {
      company: company,
      online: false,
      onlineCount: 0,
      liveFeedActive: false,
      name: '',
      brandColor: brandColor,
    },
    open: open,
    close: closePanel,
    refreshStatus: refreshStatus,
    onStatus: function (cb) {
      if (typeof cb === 'function') {
        statusListeners.push(cb);
        cb(window.LiveDesk.status);
      }
      return function unsubscribe() {
        statusListeners = statusListeners.filter(function (fn) {
          return fn !== cb;
        });
      };
    },
  };

  refreshStatus();
  setInterval(refreshStatus, 15000);
})();
