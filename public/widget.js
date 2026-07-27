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
  var origin = src ? src.replace(/\/widget\.js(?:\?.*)?$/, '') : window.location.origin;
  var widgetUrl = origin + '/w/' + encodeURIComponent(company);

  var style = document.createElement('style');
  style.textContent =
    '#livedesk-root{all:initial;font-family:system-ui,-apple-system,sans-serif}' +
    '#livedesk-root *{box-sizing:border-box}' +
    '#livedesk-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;border-radius:999px;padding:14px 20px;background:#0f766e;color:#fff;font:600 14px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(15,23,42,.25)}' +
    '#livedesk-btn:hover{filter:brightness(1.05)}' +
    '#livedesk-backdrop{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.45);display:none;align-items:flex-end;justify-content:flex-end;padding:16px}' +
    '#livedesk-backdrop.open{display:flex}' +
    '#livedesk-panel{width:min(400px,100%);height:min(640px,calc(100vh - 32px));background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 25px 60px rgba(15,23,42,.35);position:relative}' +
    '#livedesk-close{position:absolute;top:10px;right:10px;z-index:2;border:0;background:rgba(15,23,42,.08);width:32px;height:32px;border-radius:999px;cursor:pointer;font-size:18px;line-height:1}' +
    '#livedesk-frame{width:100%;height:100%;border:0;display:block}';
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.id = 'livedesk-root';

  var button = document.createElement('button');
  button.id = 'livedesk-btn';
  button.type = 'button';
  button.setAttribute('aria-label', 'Talk to us on video');
  button.textContent = 'Talk to us';

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

  button.addEventListener('click', open);
  close.addEventListener('click', closePanel);
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) closePanel();
  });
})();
