import { legalProvider } from '@/constants/legal';

export type LegalCopy = {
  title: string;
  intro: string;
  sections: { title: string; paragraphs: string[] }[];
};

/**
 * The legal texts live here rather than in the screens because App Review
 * checks the privacy URL, and the wording on getkandro.com has to stay
 * identical to what the app shows. One source per language, two consumers.
 */
export type LegalCopySet = {
  privacy: LegalCopy;
  terms: LegalCopy;
  sources: LegalCopy;
  version: string;
};

/** Appends the country unless the configured address already names it. */
function withCountry(address: string, country: string) {
  return /deutschland|germany/i.test(address) ? address : `${address}, ${country}`;
}

function provider() {
  if (!legalProvider.name) {
    return 'Verantwortlich für Kandro ist der Anbieter der App.';
  }
  const parts = [legalProvider.name];
  // Name the country: a reader outside Germany cannot tell from a postcode
  // which supervisory authority and which law apply to them.
  if (legalProvider.address) parts.push(withCountry(legalProvider.address, 'Deutschland'));
  return `Verantwortlich für die Verarbeitung ist ${parts.join(', ')}.`;
}

function contact() {
  return legalProvider.email
    ? `Datenschutzanfragen und Support erreichst du unter ${legalProvider.email}.`
    : 'Support und Datenschutzanfragen erreichst du über die im App Store hinterlegte Support-Adresse.';
}

export const legalDe: LegalCopySet = {
  version: '1.1 · Stand 2. September 2026',
  privacy: {
    title: 'Datenschutzhinweise',
    intro: 'Diese Hinweise erklären in klarer Sprache, welche Daten Kandro verarbeitet, warum, und wie du sie jederzeit wieder löschen kannst.',
    sections: [
      {
        title: '1. Verantwortlicher und Kontakt',
        paragraphs: [
          provider(),
          contact(),
        ],
      },
      {
        title: '2. Welche Daten verarbeitet werden',
        paragraphs: [
          'Auf deinem Gerät verarbeitet Kandro dein Profil, Zielwerte, Gewichtseinträge, bestätigte Mahlzeiten und höchstens drei fehlgeschlagene, komprimierte Fotoscans für einen von dir ausgelösten Wiederholungsversuch.',
          'Wenn die Cloud aktiv ist, speichert Supabase in der EU eine zufällige Account-ID, dein Profil, deine aktuellen Zielwerte, bestätigte Mahlzeiten, Zutaten, Empfehlungen und Feedback. Gewichtseinträge bleiben auf deinem Gerät; eine E-Mail-Adresse wird nur gespeichert, wenn du deinen Gast-Account bewusst sicherst.',
          'PostHog erhält nur freiwillig aktivierte, anonyme Funktionsereignisse und bereinigte Fehler. Fotos, E-Mail-Adressen, Lebensmittel, Kalorien, Makros und Supabase-IDs werden nicht an PostHog gesendet.',
        ],
      },
      {
        title: '3. Fotoanalyse und Empfänger',
        paragraphs: [
          'Ein Foto wird auf dem Gerät verkleinert. Das Original wird danach verworfen. Die Arbeitskopie oder deine bewusst eingegebene Mahlzeitenbeschreibung wird an OpenRouter in den USA und von dort ausschließlich an Microsoft Azure übermittelt; dort läuft das OpenAI-Modell GPT-4.1 mini zur Erkennung von Lebensmitteln und Portionen. USDA FoodData Central wird anschließend nur mit Textsuchbegriffen abgefragt. Bei einem Barcode wird die Nummer über den Kandro-Analysezugang bei Open Food Facts nachgeschlagen.',
          'Bestätigte Mahlzeiten enthalten kein Foto. Die lokale Fehlerwarteschlange wird auf drei Scans begrenzt und nach erfolgreicher Analyse entfernt.',
        ],
      },
      {
        title: '4. Zweck, Rechtsgrundlage und Speicherdauer',
        paragraphs: [
          'Ernährungs- und Zieldaten sind Gesundheitsdaten im Sinne von Art. 9 DSGVO. Rechtsgrundlage ist deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO, die du im Onboarding erteilst und unter „Du → Analyse & Datennutzung“ jederzeit für die Zukunft widerrufen kannst. Nach dem Widerruf sendet Kandro keine Analyse-, Körper- oder Ernährungsdaten mehr an die genannten Empfänger. Die Einwilligung wird mit Zeitstempel und Hinweisversion auf deinem Gerät und bei aktiver Cloud in deinem geschützten Profil gespeichert.',
          'Lokale Daten bleiben bis zur Löschung der App-Daten oder deines Accounts erhalten. Bestätigte Mahlzeiten werden lokal für den Verlauf gespeichert; die App lädt für den Cloud-Verlauf derzeit höchstens 90 Tage. Cloud-Daten bleiben bis zur Accountlöschung erhalten. Technisch notwendige Sicherungskopien können nach den Fristen des jeweiligen Auftragsverarbeiters auslaufen.',
        ],
      },
      {
        title: '5. Deine Rechte',
        paragraphs: [
          'Du kannst Auskunft, Berichtigung, Löschung, Einschränkung und – soweit anwendbar – Datenübertragbarkeit verlangen sowie Einwilligungen für die Zukunft widerrufen. Die anonyme Nutzungsanalyse lässt sich unter „Du“ jederzeit ausschalten.',
          'Unter „Du → Account und Daten löschen“ kannst du den Supabase-Account, die zugehörigen Cloud-Daten und den lokalen Verlauf löschen. Ein Apple-Abo muss zusätzlich in den Apple-Abonnementeinstellungen gekündigt werden.',
          'Dir steht ein Beschwerderecht bei einer Aufsichtsbehörde zu, für Nordrhein-Westfalen bei der Landesbeauftragten für Datenschutz und Informationsfreiheit NRW.',
        ],
      },
      {
        title: '6. Auftragsverarbeiter und Übermittlung',
        paragraphs: [
          'Wir setzen Supabase (Datenbank und Konto, EU-Region), OpenRouter in den USA und Microsoft Azure mit dem OpenAI-Modell GPT-4.1 mini (Bild- und Textanalyse), USDA FoodData Central und Open Food Facts (Nährwertabgleich), RevenueCat (Abo-Verwaltung) sowie optional PostHog (anonyme Nutzungsanalyse, EU) ein.',
          'Der KI-Datenweg ist auf OpenRouter und ZDR-fähige Microsoft-Azure-Endpunkte ohne Fallback begrenzt. Analyseanfragen sind mit „store: false“, untersagter Datensammlung und Zero Data Retention konfiguriert: Inhalte werden nicht zum Training verwendet und beim KI-Anbieter nicht dauerhaft gespeichert. Fotos werden ausschließlich für die Dauer der Analyse verarbeitet. OpenRouter und USDA FoodData Central verarbeiten Daten in den USA; USDA erhält nur normalisierte Lebensmittelbegriffe, keine Fotos, Account-ID oder Körperdaten.',
        ],
      },
    ],
  },
  terms: {
    title: 'Nutzungsbedingungen',
    intro: 'Diese Bedingungen beschreiben, was Kandro leistet und was nicht. Die App bleibt bewusst bei allgemeiner Wellness-Unterstützung und transparenten Schätzungen.',
    sections: [
      {
        title: '1. Leistungsumfang',
        paragraphs: [
          'Kandro ist ein allgemeines Wellness- und Planungstool für Erwachsene ab 18 Jahren. Die App strukturiert fotografierte oder beschriebene Lebensmittel beziehungsweise verpackte Produkte per Barcode, schätzt Nährwerte, berechnet einen Tagesrahmen und schlägt passende nächste Mahlzeiten aus einem kuratierten Katalog mit typischen Richtwerten vor.',
          'Alle Angaben sind Schätzungen. Du kannst erkannte Zutaten und Portionsgrößen vor dem Speichern korrigieren.',
        ],
      },
      {
        title: '2. Kein medizinischer Dienst',
        paragraphs: [
          'Kandro stellt keine Diagnose, behandelt keine Erkrankung und ersetzt keine medizinische oder ernährungstherapeutische Beratung. Triff keine medizinischen Entscheidungen allein auf Grundlage der App.',
          'Bei Beschwerden, Schwangerschaft, Essstörungen, Stoffwechselerkrankungen oder einem medizinisch angeordneten Ernährungsplan hole bitte qualifizierten Rat ein, bevor du Ziele veränderst.',
        ],
      },
      {
        title: '3. Zulässige Nutzung',
        paragraphs: [
          'Du bist für die Prüfung deiner Eingaben und Schätzwerte verantwortlich. Nutze Kandro nicht für Notfälle, Medikamentendosierungen oder klinische Entscheidungen.',
          'Automatisierte Angriffe, die Umgehung technischer Schutzmaßnahmen und die Nutzung fremder Accounts sind nicht gestattet.',
        ],
      },
      {
        title: '4. Abonnements',
        paragraphs: [
          'Preise, Laufzeit, Testzeitraum und Verlängerung werden vor dem Kauf angezeigt. Abonnements verlängern sich automatisch um die gewählte Laufzeit, bis du sie kündigst. Die Abbuchung erfolgt über deine Apple-ID; kündigen kannst du jederzeit bis 24 Stunden vor Ablauf in den Einstellungen deiner Apple-ID.',
          'Die Löschung des Kandro-Accounts beendet ein Apple-Abonnement nicht automatisch. Käufe können über die Paywall wiederhergestellt werden.',
        ],
      },
      {
        title: '5. Verfügbarkeit und Änderungen',
        paragraphs: [
          'Analyseanbieter und Nährwertdatenbanken können zeitweise nicht erreichbar sein. Kandro hält bei Netzfehlern höchstens drei komprimierte Scans lokal für einen manuellen Wiederholungsversuch bereit.',
          'Wesentliche Änderungen an Leistung, Datenschutz oder Preisen werden vor Inkrafttreten transparent angezeigt.',
        ],
      },
      {
        title: '6. Anbieter und anwendbares Recht',
        paragraphs: [
          `${provider()} ${contact()}`,
          'Es gilt deutsches Recht unter Wahrung der zwingenden Verbraucherschutzvorschriften deines Wohnsitzlandes. Für Abonnements, die über den App Store abgeschlossen werden, gelten zusätzlich die Bedingungen von Apple.',
        ],
      },
    ],
  },
  sources: {
    title: 'Datenquellen',
    intro: 'Erfasste Zutaten zeigen ihre Nährwertquelle. Kandro trennt Datenbankwerte, KI-gestützte Zuordnung und eigene typische Planungsrichtwerte sichtbar voneinander.',
    sections: [
      {
        title: 'Deutsche Gerichte · Bundeslebensmittelschlüssel',
        paragraphs: [
          'Für typische deutsche Gerichte verwendet Kandro geprüfte Nährwerte aus dem Bundeslebensmittelschlüssel. Das Modell erkennt Gericht und Portion, die Nährwerte selbst stammen aus dieser Datenbank und werden nicht geschätzt.',
          'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0',
          'Lizenz: Creative Commons Namensnennung 4.0 International (CC BY 4.0). Die Daten wurden für die Verwendung in Kandro ausgewählt und auf Portionsgrößen umgerechnet; das Max Rubner-Institut hat Kandro weder geprüft noch unterstützt.',
        ],
      },
      {
        title: 'Einzelne Zutaten · USDA FoodData Central',
        paragraphs: [
          'Zutaten außerhalb der deutschen Gerichtereferenz werden gegen USDA FoodData Central des U.S. Department of Agriculture abgeglichen. Diese Daten stehen gemeinfrei zur Verfügung.',
          'Die Zuordnung eines deutschen Lebensmittelnamens zu einem USDA-Eintrag ist eine Schätzung. Deshalb ist bei jeder Zutat sichtbar, woher der Wert kommt, und unsichere Treffer werden als zu prüfen markiert.',
        ],
      },
      {
        title: 'Verpackte Produkte · Open Food Facts',
        paragraphs: [
          'Barcodes werden bei Open Food Facts nachgeschlagen. Die Produktdatenbank steht unter der Open Database License (ODbL) und wird von Freiwilligen gepflegt.',
          'Nährwerte verpackter Produkte stammen damit von den Herstellerangaben und können unvollständig oder veraltet sein. Prüfe den Wert im Zweifel auf der Verpackung.',
        ],
      },
      {
        title: 'Kandro-Empfehlungskatalog',
        paragraphs: [
          'Die drei nächsten Mahlzeiten stammen aus einem von Kandro kuratierten Katalog. Kalorien und Makros darin sind typische, plausible Planungsrichtwerte für die beschriebene Standardportion und keine Messwerte einer einzelnen Zubereitung. In der App sind sie als „Kandro-Katalog · typischer Richtwert“ gekennzeichnet.',
          'Der Katalog wird deterministisch nach deinem verbleibenden Tagesrahmen, Kontext und deinen Präferenzen sortiert. Die KI erfindet keine Empfehlungskarten.',
        ],
      },
      {
        title: 'So entsteht eine Foto-Schätzung',
        paragraphs: [
          'GPT-4.1 mini erkennt Lebensmittel und schätzt sichtbare Grammangaben. Kandro übernimmt Nährwerte nicht vom Modell, sondern ordnet die erkannten Begriffe Referenzen aus BLS oder USDA zu. Unsichere Zuordnungen, versteckte Kalorien und breite Portionsspannen werden markiert.',
          'Vor dem Speichern zeigt Kandro jede Zutat, Grammangabe und Quelle zur Bestätigung. Du kannst Mengen verändern oder Zutaten abwählen. Diese Prüfung ist Teil jeder Foto- und Textanalyse.',
        ],
      },
      {
        title: 'Bildmaterial',
        paragraphs: [
          'Das Beispielfoto einer Mahlzeit stammt von Markus Winkler und wird unter der Unsplash-Lizenz verwendet. Es erscheint nur, solange du noch kein eigenes Foto aufgenommen hast.',
        ],
      },
      {
        title: 'Was das für deine Zahlen bedeutet',
        paragraphs: [
          'Alle Angaben in Kandro sind Schätzungen. Auch geprüfte Referenzwerte gelten für eine Standardzubereitung – Öl, Sauce und Portionsgröße schwanken in der Praxis erheblich. Deshalb kannst du jede Zutat und jede Portion vor dem Speichern korrigieren.',
        ],
      },
    ],
  },
};
