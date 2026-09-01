import { LegalDocument, LegalSection } from '@/components/LegalDocument';
import { contactSentence, providerSentence } from '@/constants/legal';

const sections: LegalSection[] = [
  {
    title: '1. Verantwortlicher und Kontakt',
    paragraphs: [
      providerSentence(),
      contactSentence(),
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
      'Ein Foto wird auf dem Gerät verkleinert. Das Original wird danach verworfen. Die Arbeitskopie oder deine bewusst eingegebene Mahlzeitenbeschreibung geht nur an den konfigurierten Kandro-Analysezugang und von dort zur Lebensmittel- und Portionserkennung an OpenRouter oder OpenAI. USDA FoodData Central wird anschließend nur mit Textsuchbegriffen abgefragt. Bei einem Barcode wird die Nummer über den Kandro-Analysezugang bei Open Food Facts nachgeschlagen.',
      'Bestätigte Mahlzeiten enthalten kein Foto. Die lokale Fehlerwarteschlange wird auf drei Scans begrenzt und nach erfolgreicher Analyse entfernt.',
    ],
  },
  {
    title: '4. Zweck, Einwilligung und Speicherdauer',
    paragraphs: [
      'Ernährungs- und Zieldaten sind Gesundheitsdaten im Sinne von Art. 9 DSGVO. Rechtsgrundlage ist deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO, die du im Onboarding erteilst und jederzeit für die Zukunft widerrufen kannst. Sie wird mit Zeitstempel und Hinweisversion auf deinem Gerät und bei aktiver Cloud in deinem geschützten Profil gespeichert.',
      'Lokale Daten bleiben bis zur Löschung der App-Daten oder deines Accounts erhalten. Bestätigte Mahlzeiten werden lokal für den Verlauf gespeichert; die App lädt für den Cloud-Verlauf derzeit höchstens 90 Tage. Cloud-Daten bleiben bis zur Accountlöschung erhalten. Technisch notwendige Sicherungskopien können nach den Fristen des jeweiligen Auftragsverarbeiters auslaufen.',
    ],
  },
  {
    title: '5. Deine Rechte',
    paragraphs: [
      'Du kannst Auskunft, Berichtigung, Löschung, Einschränkung und – soweit anwendbar – Datenübertragbarkeit verlangen sowie Einwilligungen für die Zukunft widerrufen. Die anonyme Nutzungsanalyse lässt sich unter „Du“ jederzeit ausschalten.',
      'Unter „Du → Account und Daten löschen“ kannst du den Supabase-Account, die zugehörigen Cloud-Daten und den lokalen Verlauf löschen. Ein Apple-Abo muss zusätzlich in den Apple-Abonnementeinstellungen gekündigt werden.',
    ],
  },
  {
    title: '6. Auftragsverarbeiter und Übermittlung',
    paragraphs: [
      'Wir setzen Supabase (Datenbank und Konto, EU-Region), OpenRouter beziehungsweise OpenAI (Bild- und Textanalyse), USDA FoodData Central und Open Food Facts (Nährwertabgleich), RevenueCat (Abo-Verwaltung) sowie optional PostHog (anonyme Nutzungsanalyse, EU) ein.',
      'Für die Analyse können Daten in die USA übermittelt werden. Die Analyseanfragen sind so konfiguriert, dass Inhalte nicht zum Training verwendet werden. Fotos werden ausschließlich für die Dauer der Analyse verarbeitet und nicht dauerhaft gespeichert.',
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <LegalDocument
      intro="Diese Hinweise erklären in klarer Sprache, welche Daten Kandro verarbeitet, warum, und wie du sie jederzeit wieder löschen kannst."
      sections={sections}
      title="Datenschutzhinweise"
    />
  );
}
