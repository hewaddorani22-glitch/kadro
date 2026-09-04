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
  version: '1.6 · Stand 4. September 2026',
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
          'Damit USDA, Open Food Facts und RevenueCat nicht automatisiert überlastet werden, speichert Supabase providerspezifische Zähler mit Einweg-Pseudonymen der zufälligen Account-ID und des Ausgangsnetzwerks höchstens zwei Stunden nach ihrer letzten Nutzung. Suchbegriffe und Barcodes werden in diesen Zählern nicht gespeichert.',
          'Bei 14- oder 15-jährigen Nutzern muss ein Elternteil oder eine sorgeberechtigte Person einen Link per E-Mail bestätigen, bevor die Einwilligung abgeschlossen und die Analysefunktionen freigeschaltet werden. Die Eltern-E-Mail bleibt nur im Arbeitsspeicher der Versandfunktion und wird nicht in der Kandro-Datenbank gespeichert. Supabase speichert bis zur Bestätigung oder bis zum Ablauf nach 48 Stunden nur die ausstehende Anfrage mit einem Hash des Einmal-Tokens. Zur Abwehr automatisierten Missbrauchs von Eltern-E-Mails verbraucht jede Anfrage außerdem atomische Limits anhand getrennt gesalzener Hashwerte des App-Accounts, des Ausgangsnetzwerks und der Eltern-E-Mail. Die rohe Netzwerkadresse und Eltern-E-Mail werden dafür nicht gespeichert; diese separaten Limitdatensätze werden spätestens nach drei Stunden gelöscht. Bei erfolgreicher Bestätigung wird die Anfrage sofort gelöscht; Bestätigungszeitpunkt und Hinweisversion bleiben im geschützten Profil als Nachweis. Resend verarbeitet die Adresse und technische Zustelldaten für den Mailversand.',
          'Wenn du die optionale Nutzungsanalyse bewusst einschaltest, erhält PostHog eine zufällige, auf dem Gerät gespeicherte Distinct- beziehungsweise Geräte-ID, freigegebene Funktionsereignisse, bereinigte Fehler sowie technische Angaben zu App-Version, Betriebssystem und SDK. Fotos, E-Mail-Adressen, Lebensmittel, Kalorien, Makros und Supabase-IDs werden nicht an PostHog gesendet.',
          'Für die Aboverwaltung erhält RevenueCat die zufällige Supabase-Account-ID als Custom App User ID sowie Produkt-, Kauf-, Laufzeit- und Berechtigungsinformationen. Damit kann Kandro einen Kauf demselben Account zuordnen und wiederherstellen; RevenueCat erhält weder Mahlzeiten noch Körper- oder Ernährungsdaten.',
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
          'Kandro ist ab 14 Jahren verfügbar. In Deutschland brauchen 14- und 15-Jährige nach Art. 8 DSGVO die Erlaubnis eines Elternteils oder einer sorgeberechtigten Person, bevor die ausdrückliche Wellness-Dateneinwilligung wirksam werden kann; ab 16 kann der Nutzer selbst einwilligen. Das Elternteil bestätigt die offengelegten Empfänger und Zwecke über einen einmal verwendbaren Link, der nach 48 Stunden abläuft. Nach erfolgreicher Bestätigung wird die Anfrage samt Token-Hash sofort gelöscht; abgelaufene Anfragen entfernt ein täglicher Datenbankjob. Die Erlaubnis kann über die oben genannte Kontaktadresse widerrufen werden; der Nutzer kann die künftige Verarbeitung zusätzlich jederzeit in der App stoppen.',
          'Lokale Daten bleiben bis zur Löschung der App-Daten oder deines Accounts erhalten. Bestätigte Mahlzeiten werden lokal für den Verlauf gespeichert; die App lädt für den Cloud-Verlauf derzeit höchstens 90 Tage. Cloud-Daten bleiben bis zur Accountlöschung erhalten. Technisch notwendige Sicherungskopien können nach den Fristen des jeweiligen Auftragsverarbeiters auslaufen.',
          'Damit ein erfolgreiches Analyseergebnis nach einer unterbrochenen Antwort mit derselben Anfrage wiederhergestellt werden kann und Gratis- sowie Pro-Kontingente nicht doppelt zählen, speichert Supabase das strukturierte Nährwertergebnis mit einer zufälligen Anfrage-ID und deiner Account-ID. Foto, Base64-Arbeitskopie, Prompt und eingegebener Rohtext werden dafür nicht gespeichert. Ein stündlicher Job löscht das Ergebnis ab 22 Stunden. Danach bleiben Anfrage-ID, Status und Kontingentart höchstens 30 Tage zur Doppelaufruf- und Missbrauchsabwehr; RevenueCat-Webhook-IDs höchstens 90 Tage zur Entdoppelung. Bei Accountlöschung werden diese Kandro-Datensätze sofort mitgelöscht.',
          'Freiwillig übermittelte PostHog-Ereignisse bleiben bis zum Ablauf der im EU-Projekt konfigurierten Aufbewahrung oder bis zu einer berechtigten Löschanfrage gespeichert. Das Ausschalten stoppt künftige Übermittlungen, löscht aber nicht automatisch bereits übertragene Ereignisse. RevenueCat und Apple können Kauf- und Abohistorie so lange aufbewahren, wie dies für Wiederherstellung, Abrechnung, Betrugsabwehr oder gesetzliche Pflichten erforderlich ist. OpenRouter bewahrt keine Prompt- oder Antwortinhalte auf, speichert aber inhaltsfreie Anfrage-Metadaten nach den eigenen Aufbewahrungskriterien.',
        ],
      },
      {
        title: '5. Deine Rechte',
        paragraphs: [
          'Du kannst Auskunft, Berichtigung, Löschung, Einschränkung und, soweit anwendbar, Datenübertragbarkeit verlangen sowie Einwilligungen für die Zukunft widerrufen. Die pseudonyme Nutzungsanalyse lässt sich unter „Du“ jederzeit ausschalten.',
          'Unter „Du → Account und Daten löschen“ kannst du den Supabase-Account, die zugehörigen Cloud-Daten und den lokalen Verlauf löschen. Ein Apple-Abo muss zusätzlich in den Apple-Abonnementeinstellungen gekündigt werden. Bereits an PostHog übertragene Ereignisse sowie bei Apple oder RevenueCat geführte Kaufhistorie werden dadurch nicht automatisch gelöscht; hierfür kannst du dich an die oben genannte Kontaktadresse wenden, soweit ein Löschanspruch besteht.',
          'Dir steht ein Beschwerderecht bei einer Aufsichtsbehörde zu, für Nordrhein-Westfalen bei der Landesbeauftragten für Datenschutz und Informationsfreiheit NRW.',
        ],
      },
      {
        title: '6. Auftragsverarbeiter und Übermittlung',
        paragraphs: [
          'Wir setzen Supabase (Datenbank und Konto, EU-Region), OpenRouter in den USA und Microsoft Azure mit dem OpenAI-Modell GPT-4.1 mini (Bild- und Textanalyse), USDA FoodData Central und Open Food Facts (Nährwertabgleich), RevenueCat (Aboverwaltung mit verknüpfter Account-ID und Kaufstatus), Resend (Eltern- und Wartelisten-E-Mails) sowie optional PostHog (pseudonyme Nutzungsanalyse, EU) ein. Für Nutzer unter 18 bleibt die optionale Nutzungsanalyse ausgeschaltet.',
          'Der KI-Datenweg ist auf OpenRouter und ZDR-fähige Microsoft-Azure-Endpunkte ohne Fallback begrenzt. Analyseanfragen sind mit „store: false“, untersagter Datensammlung und Zero Data Retention konfiguriert: Prompt-, Foto- und Antwortinhalte werden nicht zum Training verwendet und von OpenRouter oder dem ausgewählten Inferenz-Endpunkt nicht aufbewahrt. OpenRouter speichert getrennt davon inhaltsfreie Anfrage-Metadaten wie Zeitpunkt, verwendetes Modell, Tokenanzahl und Latenz für Abrechnung, Berichte und Modell-Ranking. Nach eigener Dokumentation kann OpenRouter eine kleine Zahl von Prompts vorübergehend durch ein ZDR-Modell anonym kategorisieren; gespeichert wird nur die nicht mit Account oder Nutzer-ID verknüpfte Kategorie, nicht der Prompt. Fotos werden ausschließlich für die Dauer der Analyse verarbeitet. OpenRouter und USDA FoodData Central verarbeiten Daten in den USA; USDA erhält nur normalisierte Lebensmittelbegriffe, keine Fotos, Account-ID oder Körperdaten.',
          'RevenueCat verarbeitet die Supabase-Account-ID zusammen mit Produkt-, Kauf-, Abo- und Berechtigungsstatus. PostHog verarbeitet bei freiwilliger Aktivierung die pseudonyme Distinct-ID, freigegebene Produktinteraktionen, bereinigte Fehler und technische App-, Betriebssystem- und SDK-Angaben. Resend verarbeitet E-Mail-Adresse und technische Zustelldaten für die jeweilige Nachricht. Die Speicherfristen richten sich nach den oben beschriebenen Zwecken und den Aufbewahrungs- beziehungsweise Löschregeln des jeweiligen Auftragsverarbeiters; Details und Löschanfragen kannst du über die Kontaktadresse erhalten.',
        ],
      },
      {
        title: '7. Warteliste auf getkandro.com',
        paragraphs: [
          'Wer sich auf der Website für die Benachrichtigung zum Start einträgt, gibt eine E-Mail-Adresse an. Wir speichern sie zusammen mit der gewählten Sprache, einer optionalen Kampagnenquelle aus dem „ref“-Parameter sowie den Zeitpunkten von Anmeldung und Bestätigung. Die Website speichert deine Sprachwahl zusätzlich lokal im Browser. Rechtsgrundlage für die Warteliste ist deine Einwilligung, Art. 6 Abs. 1 lit. a DSGVO.',
          'Die Anmeldung läuft im Double-Opt-in: Nach dem Absenden erhältst du eine Bestätigungsmail, und erst der Klick darin trägt dich ein. Ohne diesen Klick verwenden wir die Adresse nicht. Für Bestätigung und Abmeldung speichern wir getrennte zufällige Token. Zur Abwehr automatisierter Massenanmeldungen speichern wir außerdem einen gesalzenen Hashwert der IP-Adresse, nicht die IP-Adresse selbst. Jeder Anmeldeversuch verbraucht zusätzlich ein atomisches Limit anhand getrennt gesalzener Hashwerte der IP- und E-Mail-Adresse. Diese separaten Limitdatensätze werden spätestens nach drei Stunden gelöscht.',
          'Die Adresse wird ausschließlich für die Benachrichtigung zum Start und für damit unmittelbar zusammenhängende Nachrichten verwendet, nicht für laufenden Newsletter-Versand. Jede Mail enthält einen Abmeldelink; nach dessen Bestätigung wird der gesamte Wartelisteneintrag sofort gelöscht. Unbestätigte Einträge werden nach 30 Tagen gelöscht. Bestätigte Einträge werden spätestens sechs Monate nach dem tatsächlich veröffentlichten und im System hinterlegten App-Start gelöscht. Ein täglicher Datenbankjob setzt diese Fristen um.',
          'Für den Versand setzen wir Resend ein; Resend verarbeitet die Adresse und technische Zustelldaten nach den eigenen Aufbewahrungskriterien. Die Wartelisteneinträge werden bis zu ihrer vorstehend beschriebenen Löschung bei Supabase in der EU gespeichert.',
          'Der Discord-Server ist ein Angebot von Discord. Wer beitritt, tut dies gegenüber Discord; wir erhalten dabei keine Daten von dir und haben auf die Verarbeitung durch Discord keinen Einfluss.',
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
          'Kandro ist ein allgemeines Wellness- und Planungstool für Nutzer ab 14 Jahren. Bei 14- oder 15-Jährigen muss ein Elternteil oder eine sorgeberechtigte Person zustimmen, bevor die Einwilligung abgeschlossen und die Analysefunktionen freigeschaltet werden. Die App strukturiert fotografierte oder beschriebene Lebensmittel beziehungsweise verpackte Produkte per Barcode, schätzt Nährwerte, berechnet einen Tagesrahmen und schlägt passende nächste Mahlzeiten aus einem kuratierten Katalog mit typischen Richtwerten vor.',
          'Alle Angaben sind Schätzungen. Du kannst erkannte Zutaten und Portionsgrößen vor dem Speichern korrigieren.',
        ],
      },
      {
        title: '2. Kein medizinischer Dienst',
        paragraphs: [
          'Kandro stellt keine Diagnose, behandelt keine Erkrankung und ersetzt keine medizinische oder ernährungstherapeutische Beratung. Triff keine medizinischen Entscheidungen allein auf Grundlage der App.',
          'Für 14- bis 17-Jährige verwendet Kandro eine Jugend-Energiebilanz, die normales Wachstum berücksichtigt, und gibt weder Kaloriendefizit noch -überschuss vor. Ziele beeinflussen Mahlzeitenideen, nicht ein Gewichtsänderungstempo. Bei Sorgen um Gewicht oder Wachstum beziehe ein Elternteil ein und hole qualifizierten Rat ein.',
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
          'Käufe Minderjähriger brauchen die für ihre Apple-ID geltende Freigabe, etwa „Kaufanfrage“ oder die Zustimmung des Familienorganisators. Kandro umgeht Apples Kaufkontrollen nicht.',
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
          'Für typische deutsche Gerichte verwendet Kandro geprüfte Referenzwerte aus dem Bundeslebensmittelschlüssel. Diese Werte werden nicht von der KI erzeugt, sondern sind Datenbank- und Durchschnittswerte. Die Zuordnung zum erkannten Gericht, die angenommene Zubereitung und die Skalierung auf die geschätzte Portion bleiben Schätzungen.',
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
