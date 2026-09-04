/*
 * The Discord invite, in one place.
 *
 * Empty until a real invite exists, and the buttons stay hidden while it is :
 * a dead "join us" link on a launch page costs more than no link at all.
 * Create the invite in Discord (Server Settings, Invites, no expiry, no use
 * limit) and paste it here; both language versions pick it up.
 */
window.KANDRO_DISCORD = 'https://discord.gg/D6KCXWtuUd';

function showDiscordLinks() {
  if (!window.KANDRO_DISCORD) return;
  var links = document.querySelectorAll('[data-discord]');
  for (var index = 0; index < links.length; index += 1) {
    links[index].href = window.KANDRO_DISCORD;
    links[index].hidden = false;
  }
}

// Waiting for DOMContentLoaded alone means nothing happens at all if the file
// arrives after the document is already parsed: from cache, or moved into the
// head one day: and the button silently stays hidden.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showDiscordLinks);
} else {
  showDiscordLinks();
}
