/*
 * Confirms a waitlist sign-up.
 *
 * The link in the mail points at getkandro.com rather than straight at the
 * function: a confirmation link to a supabase.co URL reads like phishing, and
 * an address that will not click is an address that never joins.
 */
(function () {
  var ENDPOINT = 'https://omtmxqzwxvthycyfkggv.supabase.co/functions/v1/waitlist';
  var target = document.querySelector('[data-confirm]');
  if (!target) return;

  var language = document.documentElement.lang === 'en' ? 'en' : 'de';
  var text = language === 'en'
    ? { working: 'Confirming…', done: 'You are on the list. We will write once Kandro is live.', bad: 'This link is no longer valid. Sign up again on the home page.' }
    : { working: 'Wird bestätigt …', done: 'Du stehst auf der Liste. Wir schreiben dir, sobald Kandro live ist.', bad: 'Dieser Link gilt nicht mehr. Melde dich auf der Startseite noch einmal an.' };

  var token = new URLSearchParams(location.search).get('t') || '';
  target.textContent = text.working;

  fetch(ENDPOINT + '/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token }),
  })
    .then(function (response) { target.textContent = response.ok ? text.done : text.bad; })
    .catch(function () { target.textContent = text.bad; });
})();
