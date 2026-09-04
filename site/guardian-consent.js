(function () {
  var ENDPOINT = 'https://omtmxqzwxvthycyfkggv.supabase.co/functions/v1/guardian-consent';
  var form = document.querySelector('[data-guardian-confirm]');
  if (!form) return;
  var status = document.querySelector('[data-guardian-status]');
  var button = form.querySelector('button');
  var checkbox = form.querySelector('input[type=checkbox]');
  var language = document.documentElement.lang === 'de' ? 'de' : 'en';
  var text = language === 'de'
    ? { working: 'Wird bestätigt …', done: 'Erlaubnis bestätigt. Die Person kann jetzt in Kandro auf „erneut prüfen“ tippen.', bad: 'Dieser Link ist ungültig oder abgelaufen. Bitte lass eine neue Anfrage aus der App senden.', required: 'Bitte bestätige zuerst, dass du sorgeberechtigt und mindestens 18 Jahre alt bist.' }
    : { working: 'Confirming…', done: 'Permission confirmed. The person can now tap “check again” in Kandro.', bad: 'This link is invalid or has expired. Ask the user to send a new request from the app.', required: 'First confirm that you are the legal guardian and at least 18 years old.' };

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!checkbox.checked) { status.textContent = text.required; status.className = 'form-status bad'; return; }
    var token = new URLSearchParams(location.search).get('t') || '';
    button.disabled = true;
    status.textContent = text.working;
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', token: token, guardianConfirmed: true }),
    })
      .then(function (response) {
        status.textContent = response.ok ? text.done : text.bad;
        status.className = 'form-status ' + (response.ok ? 'ok' : 'bad');
        if (response.ok) form.hidden = true;
      })
      .catch(function () { status.textContent = text.bad; status.className = 'form-status bad'; })
      .finally(function () { button.disabled = false; });
  });
})();
