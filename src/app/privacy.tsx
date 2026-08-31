import { LegalDocument, LegalSection } from '@/components/LegalDocument';

const contact = process.env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();

const sections: LegalSection[] = [
  {
    title: '1. Verantwortlicher und Kontakt',
    paragraphs: [
      contact
        ? `Verantwortlich für Kadro ist der Anbieter der App. Datenschutzanfragen erreichst du unter ${contact}.`
        : 'Der verantwortliche Anbieter und eine öffentliche Datenschutz-Kontaktadresse müssen vor der externen TestFlight- oder App-Store-Veröffentlichung ergänzt werden.',
    ],
  },
  {
    title: '2. Welche Daten verarbeitet werden',
    paragraphs: [
      'Auf deinem Gerät verarbeitet Kadro dein Profil, Zielwerte, Gewichtseinträge, bestätigte Mahlzeiten und höchstens drei fehlgeschlagene, komprimierte Fotoscans für einen von dir ausgelösten Wiederholungsversuch.',
      'Wenn die Cloud aktiv ist, speichert Supabase in der EU eine zufällige Account-ID, dein Profil, deine aktuellen Zielwerte, bestätigte Mahlzeiten, Zutaten, Empfehlungen und Feedback. Gewichtseinträge bleiben im MVP lokal; eine E-Mail-Adresse wird nur gespeichert, wenn du den Gast-Account bewusst sicherst.',
      'PostHog erhält nur freiwillig aktivierte, anonyme Funktionsereignisse und bereinigte Fehler. Fotos, E-Mail-Adressen, Lebensmittel, Kalorien, Makros und Supabase-IDs werden nicht an PostHog gesendet.',
    ],
  },
  {
    title: '3. Fotoanalyse und Empfänger',
    paragraphs: [
      'Ein Foto wird auf dem Gerät verkleinert. Das Original wird danach verworfen. Die Arbeitskopie oder deine bewusst eingegebene Mahlzeitenbeschreibung geht nur an den konfigurierten Kadro-Analysezugang und von dort zur Lebensmittel- und Portionserkennung an OpenRouter oder OpenAI. USDA FoodData Central wird anschließend nur mit Textsuchbegriffen abgefragt. Bei einem Barcode wird die Nummer über den Kadro-Analysezugang bei Open Food Facts nachgeschlagen.',
      'Bestätigte Mahlzeiten enthalten kein Foto. Die lokale Fehlerwarteschlange wird auf drei Scans begrenzt und nach erfolgreicher Analyse entfernt.',
    ],
  },
  {
    title: '4. Zweck, Einwilligung und Speicherdauer',
    paragraphs: [
      'Ernährungs- und Zieldaten werden ausschließlich verarbeitet, um Schätzungen, Tagesstände und Empfehlungen für dich bereitzustellen. Deine ausdrückliche Einwilligung wird mit Zeitstempel und Hinweisversion lokal sowie bei aktiver Cloud im geschützten Profil gespeichert. Die finale Rechtsgrundlagen- und Einwilligungsprüfung bleibt vor externer Veröffentlichung erforderlich.',
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
    title: '6. Wichtiger Veröffentlichungsstatus',
    paragraphs: [
      'Dies ist ein transparenter MVP-Entwurf und noch keine anwaltlich geprüfte Endfassung. Anbieteridentität, Kontaktadresse, Auftragsverarbeitungsverträge, internationale Übermittlungen und konkrete Löschfristen müssen vor externer Verteilung final bestätigt werden.',
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <LegalDocument
      intro="Diese Hinweise erklären in klarer Sprache, welche Daten Kadro im aktuellen MVP verarbeitet und welche Punkte vor einer öffentlichen Veröffentlichung noch abgeschlossen werden müssen."
      sections={sections}
      title="Datenschutzhinweise"
    />
  );
}
