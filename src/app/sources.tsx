import { LegalDocument, LegalSection } from '@/components/LegalDocument';

/**
 * Required attribution, not a nicety. BLS 4.0 is CC BY 4.0 and Open Food Facts
 * is ODbL; both oblige us to name the source in the product itself, and a
 * comment in the source code is not something a user can read.
 */
const sections: LegalSection[] = [
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
];

export default function SourcesScreen() {
  return (
    <LegalDocument
      intro="Kandro erfindet keine Nährwerte. Jede Zahl stammt aus einer benannten Quelle, und bei jeder erfassten Zutat siehst du, aus welcher."
      sections={sections}
      title="Datenquellen"
    />
  );
}
