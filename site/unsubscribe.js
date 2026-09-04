/*
 * Deletes one waitlist row after an explicit confirmation. The emailed token
 * is never sent anywhere except Kandro's own Supabase Edge Function.
 */
(function () {
  var ENDPOINT = 'https://omtmxqzwxvthycyfkggv.supabase.co/functions/v1/waitlist';
  var form = document.querySelector('[data-unsubscribe]');
  var status = document.querySelector('[data-unsubscribe-status]');
  if (!form || !status) return;

  var language = document.documentElement.lang === 'de' ? 'de' : 'en';
  var text = language === 'de'
    ? {
        working: 'Eintrag wird gelöscht …',
        done: 'Dein Wartelisteneintrag wurde gelöscht. Du erhältst keine weiteren Wartelisten-E-Mails.',
        bad: 'Dieser Link ist ungültig. Wenn du Hilfe brauchst, melde dich beim Support.',
        failed: 'Die Abmeldung ist gerade nicht erreichbar. Bitte versuche es später erneut.',
      }
    : {
        working: 'Deleting your entry…',
        done: 'Your waiting-list entry has been deleted. You will not receive any more waiting-list emails.',
        bad: 'This link is invalid. Contact support if you need help.',
        failed: 'Unsubscription is temporarily unavailable. Please try again later.',
      };

  var token = new URLSearchParams(location.search).get('t') || '';
  var languageLink = document.querySelector('[data-unsubscribe-language]');
  if (languageLink && /^[a-f0-9]{48}$/.test(token)) {
    languageLink.href += '?t=' + encodeURIComponent(token);
  }

  if (!/^[a-f0-9]{48}$/.test(token)) {
    status.textContent = text.bad;
    status.className = 'form-status bad';
    return;
  }
  form.hidden = false;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var button = form.querySelector('button');
    button.disabled = true;
    status.textContent = text.working;
    status.className = 'form-status';

    fetch(ENDPOINT + '/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('unsubscribe_failed');
        status.textContent = text.done;
        status.className = 'form-status ok';
        form.hidden = true;
      })
      .catch(function () {
        status.textContent = text.failed;
        status.className = 'form-status bad';
        button.disabled = false;
      });
  });
})();
