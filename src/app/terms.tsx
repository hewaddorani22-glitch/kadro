import { LegalDocument, LegalSection } from '@/components/LegalDocument';

const sections: LegalSection[] = [
  {
    title: '1. Leistungsumfang',
    paragraphs: [
      'Kandro ist ein allgemeines Wellness- und Planungstool. Die App strukturiert fotografierte oder beschriebene Lebensmittel beziehungsweise verpackte Produkte per Barcode, schätzt Nährwerte, berechnet einen Tagesrahmen und schlägt passende nächste Mahlzeiten aus einer überprüften Bibliothek vor.',
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
      'Preise, Laufzeit, Testzeitraum und Verlängerung werden vor einem Kauf angezeigt. Native Abonnements werden über den jeweiligen App Store verwaltet und müssen dort gekündigt werden.',
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
    title: '6. MVP-Status',
    paragraphs: [
      'Diese Bedingungen sind ein Produktentwurf. Anbieterangaben, anwendbares Recht, Haftungsrahmen und Verbraucherschutzinformationen müssen vor einer öffentlichen TestFlight- oder App-Store-Veröffentlichung rechtlich finalisiert werden.',
    ],
  },
];

export default function TermsScreen() {
  return (
    <LegalDocument
      intro="Diese Bedingungen beschreiben den vorgesehenen Rahmen des Kandro-MVP. Die App bleibt bewusst bei allgemeiner Wellness-Unterstützung und transparenten Schätzungen."
      sections={sections}
      title="Nutzungsbedingungen"
    />
  );
}
