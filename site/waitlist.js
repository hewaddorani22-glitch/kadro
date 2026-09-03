/*
 * Waitlist sign-up for the landing page.
 *
 * The form is drawn only after the endpoint says it can actually send a
 * confirmation mail: without a sender there is no way to complete a double
 * opt-in, and an address collected that way is one you are never allowed to
 * write to. Discord needs none of this and is always offered.
 */
(function () {
  var ENDPOINT = 'https://omtmxqzwxvthycyfkggv.supabase.co/functions/v1/waitlist';
  var form = document.querySelector('[data-waitlist]');
  if (!form) return;

  var language = document.documentElement.lang === 'en' ? 'en' : 'de';
  // From the document, not the form: the status line sits beside the form so
  // it still has somewhere to say "sign-ups open shortly" while the form
  // itself is hidden. Scoping the lookup to the form found nothing, and every
  // message the script tried to show threw instead.
  var status = document.querySelector('[data-waitlist-status]');
  var input = form.querySelector('input[type=email]');
  var button = form.querySelector('button');
  var say = function (message, tone) {
    status.textContent = message;
    status.className = 'form-status' + (tone ? ' ' + tone : '');
  };

  var text = language === 'en'
    ? {
      sending: 'Sending…',
      sent: 'Check your inbox — one click and you are on the list.',
      invalid: 'That does not look like an email address.',
      many: 'That is a lot of sign-ups from one connection. Try again later.',
      failed: 'That did not work. Try again in a moment.',
      closed: 'Sign-ups open shortly.',
      closedDiscord: 'Sign-ups open shortly. Join the Discord in the meantime.',
    }
    : {
      sending: 'Wird gesendet …',
      sent: 'Schau in dein Postfach – ein Klick, und du stehst auf der Liste.',
      invalid: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
      many: 'Das sind viele Anmeldungen aus einem Anschluss. Versuch es später.',
      failed: 'Das hat nicht geklappt. Versuch es gleich noch einmal.',
      closed: 'Die Anmeldung öffnet in Kürze.',
      closedDiscord: 'Die Anmeldung öffnet in Kürze. Komm solange auf den Discord.',
    };

  // Only points at Discord when there is a Discord button to point at: the
  // invite and the sender are configured independently, and a sentence sending
  // people to a button that is not there is worse than a shorter sentence.
  var closedMessage = function () {
    return window.KANDRO_DISCORD ? text.closedDiscord : text.closed;
  };

  fetch(ENDPOINT + '/status')
    .then(function (response) { return response.json(); })
    .then(function (payload) {
      form.hidden = false;
      if (payload && payload.accepting) return;
      // Visible but inert: an empty space where a sign-up should be looks
      // broken, and the reason it cannot take an address yet is worth saying.
      input.disabled = true;
      button.disabled = true;
      say(closedMessage());
    })
    .catch(function () { /* Discord stays; the form simply does not appear. */ });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    button.disabled = true;
    say(text.sending);
    fetch(ENDPOINT + '/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.value,
        language: language,
        source: new URLSearchParams(location.search).get('ref') || 'site',
      }),
    })
      .then(function (response) {
        if (response.ok) {
          form.reset();
          say(text.sent, 'ok');
          return;
        }
        if (response.status === 400) say(text.invalid, 'bad');
        else if (response.status === 429) say(text.many, 'bad');
        else if (response.status === 503) say(closedMessage());
        else say(text.failed, 'bad');
      })
      .catch(function () { say(text.failed, 'bad'); })
      .finally(function () { button.disabled = false; });
  });
})();
