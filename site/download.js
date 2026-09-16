(function () {
  var help = document.getElementById('download-help');
  if (!help) return;
  var german = document.documentElement.lang === 'de';
  var ua = navigator.userAgent || '';
  // Best-effort detection only: the manual help remains available even when
  // a webview does not identify itself. Never try to bypass its URL policy.
  var tiktok = /TikTok|musical_ly|Bytedance|ByteLocale|\btrill\b/i.test(ua);
  var android = /Android/i.test(ua);
  var summary = help.querySelector('summary');
  var input = help.querySelector('input');
  var copy = help.querySelector('[data-copy-store]');
  var status = help.querySelector('[data-copy-status]');

  if (tiktok && !android) {
    summary.textContent = german ? 'Aus TikTok? In Safari herunterladen' : 'Coming from TikTok? Download with Safari';
    document.querySelectorAll('[data-app-store]').forEach(function (link) {
      // Keep an ordinary HTTPS href for no-JS, modifier-click and copy-link use.
      link.textContent = german ? 'Auf iPhone laden' : 'Get it on iPhone';
      link.setAttribute('aria-controls', 'download-help');
      link.addEventListener('click', function (event) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        help.open = true;
        help.scrollIntoView({ block: 'center' });
        summary.focus({ preventScroll: true });
      });
    });
  }

  copy.hidden = false;
  copy.addEventListener('click', function () {
    var manual = function () {
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      status.textContent = german
        ? 'Link markiert. Kopiere ihn und füge ihn in Safari ein.'
        : 'Link selected. Copy it and paste it into Safari.';
    };
    if (!navigator.clipboard || !navigator.clipboard.writeText) { manual(); return; }
    navigator.clipboard.writeText(input.value).then(function () {
      status.textContent = german
        ? 'Link kopiert. Öffne Safari und füge ihn in die Adressleiste ein.'
        : 'Link copied. Open Safari and paste it into the address bar.';
    }, manual);
  });
})();
