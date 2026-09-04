/**
 * Renders the legal pages of getkandro.com from the same dictionaries the app
 * screens use.
 *
 * The site used to carry hand-maintained copies with a README note saying
 * "change both". They had already drifted: the site said "Account-ID" where
 * the app said "Supabase-IDs", and the two numbered §4 differently. A reviewer
 * comparing the in-app privacy screen with the privacy URL sees that.
 *
 *   node scripts/build-site-legal.mjs          writes the pages
 *   node scripts/build-site-legal.mjs --check  fails if they are out of date
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

import 'dotenv/config';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

/**
 * The dictionaries are TypeScript and import through the `@/` alias. Transpile
 * them with the compiler the project already depends on rather than stripping
 * types by hand: a regex silently produced invalid JavaScript the moment a
 * helper gained an annotated parameter.
 */
async function loadCopy(language) {
  const source = await readFile(resolve(projectRoot, `src/i18n/legal.${language}.ts`), 'utf8');
  const provider = {
    name: process.env.EXPO_PUBLIC_LEGAL_PROVIDER_NAME?.trim() ?? '',
    address: process.env.EXPO_PUBLIC_LEGAL_PROVIDER_ADDRESS?.trim() ?? '',
    email: process.env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() ?? '',
  };
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const module = outputText
    .replace(/^import[^;]+;$/gm, '')
    .replace(/^export const legal(De|En) = /m, 'export const copy = ');
  const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(
    `const legalProvider = ${JSON.stringify(provider)};\n${module}`,
  )}`;
  const { copy } = await import(url);
  return copy;
}

const escape = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** Turn the plain email in the copy into a mailto link, after escaping. */
function linkEmail(html) {
  const email = process.env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  if (!email) return html;
  return html.replaceAll(escape(email), `<a href="mailto:${escape(email)}">${escape(email)}</a>`);
}

const chrome = {
  de: {
    lang: 'de',
    ogLocale: 'de_DE',
    // Paths are relative to the page directory: German pages sit at
    // site/<slug>/, English ones one level deeper at site/en/<slug>/.
    nav: [['../support/', 'Support'], ['../privacy/', 'Datenschutz'], ['../terms/', 'Bedingungen'], ['../sources/', 'Datenquellen'], ['../impressum/', 'Impressum']],
    switchLabel: 'English',
    versionPrefix: 'Version',
    descriptions: {
      privacy: 'Welche Daten die Kandro-App verarbeitet, warum, und wie du sie löschst.',
      terms: 'Was Kandro leistet, was nicht, und wie das Abo funktioniert.',
      sources: 'Woher die Nährwerte in Kandro stammen und unter welcher Lizenz.',
    },
  },
  en: {
    lang: 'en',
    ogLocale: 'en_GB',
    nav: [['../support/', 'Support'], ['../privacy/', 'Privacy'], ['../terms/', 'Terms'], ['../sources/', 'Data sources'], ['../../impressum/', 'Imprint']],
    switchLabel: 'Deutsch',
    versionPrefix: 'Version',
    descriptions: {
      privacy: 'What data the Kandro app processes, why, and how you delete it.',
      terms: 'What Kandro does, what it does not do, and how the subscription works.',
      sources: 'Where the nutrition values in Kandro come from and under which licence.',
    },
  },
};

const BRAND = '<svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><path d="M 47.56 16.44 A 22 22 0 1 1 16.44 16.44" fill="none" stroke="#3F5233" stroke-linecap="round" stroke-width="6.5"/><circle cx="32" cy="7.5" r="4.8" fill="#BBDC8E"/></svg><span>Kandro</span>';

function render({ language, slug, doc, version }) {
  const meta = chrome[language];
  const isEnglish = language === 'en';
  const up = isEnglish ? '../../' : '../';
  const canonical = `https://getkandro.com/${isEnglish ? 'en/' : ''}${slug}`;
  const alternate = isEnglish ? `https://getkandro.com/${slug}` : `https://getkandro.com/en/${slug}`;
  const switchHref = isEnglish ? `../../${slug}/` : `../en/${slug}/`;
  const description = meta.descriptions[slug];
  const nav = meta.nav.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
  const footerNav = meta.nav.map(([href, label]) => `<a href="${href}">${label}</a>`).join(' · ');

  const body = doc.sections.map((section) => {
    const paragraphs = section.paragraphs.map((p) => `  <p>${linkEmail(escape(p))}</p>`).join('\n');
    return `  <h2>${escape(section.title)}</h2>\n${paragraphs}`;
  }).join('\n\n');

  return `<!doctype html>
<html lang="${meta.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(doc.title)}: Kandro</title>
<meta name="description" content="${escape(description)}">
<link rel="stylesheet" href="${up}styles.css">
<link rel="icon" href="${up}icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${up}icon.svg">
<meta name="theme-color" content="#F5F3EE">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kandro">
<meta property="og:title" content="${escape(doc.title)}: Kandro">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="https://getkandro.com/social.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Kandro">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:locale" content="${meta.ogLocale}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="${meta.lang}" href="${canonical}">
<link rel="alternate" hreflang="${isEnglish ? 'de' : 'en'}" href="${alternate}">
<link rel="alternate" hreflang="x-default" href="https://getkandro.com/${slug}">
</head>
<body>
<header class="site"><div class="wrap wide"><a class="brand" href="${up}">${BRAND}</a><nav class="site">${nav}<a class="lang" href="${switchHref}" hreflang="${isEnglish ? 'de' : 'en'}">${meta.switchLabel}</a></nav></div></header>
<main><div class="wrap">
  <p class="eyebrow">${meta.versionPrefix} ${escape(version)}</p>
  <h1>${escape(doc.title)}</h1>
  <p class="lead">${escape(doc.intro)}</p>

${body}
</div></main>
<footer class="site"><div class="wrap wide"><span class="small">© 2026 Hewad Dorani · Essen</span><span class="small">${footerNav}</span></div></footer>
</body>
</html>
`;
}

const stale = [];
for (const language of ['de', 'en']) {
  const copy = await loadCopy(language);
  for (const slug of ['privacy', 'terms', 'sources']) {
    const path = resolve(projectRoot, 'site', language === 'en' ? 'en' : '', slug, 'index.html');
    const html = render({ language, slug, doc: copy[slug], version: copy.version });
    const existing = await readFile(path, 'utf8').catch(() => null);
    if (existing === html) continue;
    if (check) {
      stale.push(`site/${language === 'en' ? 'en/' : ''}${slug}/index.html`);
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, html);
    console.log(`wrote ${path.replace(projectRoot + '/', '')}`);
  }
}

if (stale.length) {
  throw new Error(
    `The website legal pages no longer match the app copy:\n- ${stale.join('\n- ')}\nRun: npm run site:legal`,
  );
}
console.log(check ? 'Website legal pages match the app copy in both languages.' : 'Website legal pages rebuilt.');
