(function () {
  var ENDPOINT = 'https://omtmxqzwxvthycyfkggv.supabase.co/functions/v1/waitlist';
  var forms = document.querySelectorAll('[data-waitlist]');
  if (!forms.length) return;

  var language = document.documentElement.lang === 'de' ? 'de' : 'en';
  var text = language === 'de'
    ? {
      sending: 'Wird gesendet …', sent: 'Fast geschafft: bestätige jetzt den Link in deinem Postfach.',
      invalid: 'Bitte prüfe deine E-Mail-Adresse.', many: 'Zu viele Versuche aus diesem Netzwerk. Bitte später erneut versuchen.',
      failed: 'Das hat gerade nicht geklappt. Versuch es bitte gleich noch einmal.', closed: 'Die Anmeldung öffnet in Kürze.',
      closedDiscord: 'Die Anmeldung öffnet in Kürze. Komm solange auf den Discord.'
    }
    : {
      sending: 'Sending…', sent: 'Almost there: confirm the link in your inbox.',
      invalid: 'Please check your email address.', many: 'Too many attempts from this network. Please try again later.',
      failed: 'That did not work just now. Please try again in a moment.', closed: 'Sign-ups open shortly.',
      closedDiscord: 'Sign-ups open shortly. Join the Discord in the meantime.'
    };

  var closedMessage = function () { return window.KANDRO_DISCORD ? text.closedDiscord : text.closed; };

  var controls = [];
  for (var index = 0; index < forms.length; index += 1) {
    var form = forms[index];
    var block = form.closest('.signup-block') || form.parentElement;
    var status = block.querySelector('[data-waitlist-status]');
    var input = form.querySelector('input[type=email]');
    var button = form.querySelector('button');
    controls.push({ form: form, status: status, input: input, button: button });
  }

  var say = function (control, message, tone) {
    control.status.textContent = message;
    control.status.className = 'form-status' + (tone ? ' ' + tone : '');
  };

  var statusController = new AbortController();
  var statusTimeout = setTimeout(function () { statusController.abort(); }, 8000);
  fetch(ENDPOINT + '/status', { signal: statusController.signal })
    .then(function (response) {
      if (!response.ok) throw new Error('Status unavailable');
      return response.json();
    })
    .then(function (payload) {
      for (var index = 0; index < controls.length; index += 1) {
        var control = controls[index];
        control.form.hidden = false;
        if (payload && payload.accepting) continue;
        control.input.disabled = true;
        control.button.disabled = true;
        say(control, closedMessage());
      }
    })
    .catch(function () {
      for (var index = 0; index < controls.length; index += 1) {
        var control = controls[index];
        // The status check is advisory. A manual submission can retry the
        // server, which still refuses sign-ups when delivery is unavailable.
        control.form.hidden = false;
        say(control, text.failed, 'bad');
      }
    })
    .finally(function () { clearTimeout(statusTimeout); });

  var subscribe = function (control) {
    control.form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!control.form.reportValidity()) return;
      control.button.disabled = true;
      say(control, text.sending);
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      fetch(ENDPOINT + '/subscribe', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: control.input.value,
          language: language,
          source: new URLSearchParams(location.search).get('ref') || 'site',
        }),
      })
        .then(function (response) {
          if (response.ok) { control.form.reset(); say(control, text.sent, 'ok'); return; }
          if (response.status === 400) say(control, text.invalid, 'bad');
          else if (response.status === 429) say(control, text.many, 'bad');
          else if (response.status === 503) say(control, closedMessage());
          else say(control, text.failed, 'bad');
        })
        .catch(function () { say(control, text.failed, 'bad'); })
        .finally(function () { clearTimeout(timeout); control.button.disabled = false; });
    });
  };
  for (var item = 0; item < controls.length; item += 1) subscribe(controls[item]);
})();
