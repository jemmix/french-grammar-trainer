import type { Section, SectionMeta } from "../types";
import { loadSectionsFromDsl } from "../loader";

export const meta: Omit<SectionMeta, "questionCount">[] = [
  { id: "01-artikel-genus", title: "Artikel und Genus", description: "Bestimmte und unbestimmte Artikel, Genus, Pluralbildung, Possessivartikel" },
  { id: "02-akkusativ", title: "Der Akkusativ", description: "Akkusativartikel, Akkusativpronomen, Akkusativpräpositionen" },
  { id: "03-dativ", title: "Der Dativ", description: "Dativartikel, Dativpronomen, Dativpräpositionen, Wechselpräpositionen" },
  { id: "04-praesens", title: "Das Präsens", description: "Regelmäßige und unregelmäßige Verben, Modalverben, trennbare Verben" },
  { id: "05-perfekt", title: "Das Perfekt", description: "Partizip II, haben vs. sein, trennbare und untrennbare Verben" },
  { id: "06-adjektivdeklination", title: "Adjektivdeklination", description: "Schwache, gemischte und starke Deklination, Komparation" },
  { id: "07-wortstellung-konjunktionen", title: "Wortstellung und Konjunktionen", description: "V2-Regel, Nebensätze, koordinierende und unterordnende Konjunktionen" },
  { id: "08-praepositionen", title: "Präpositionen", description: "Akkusativ-, Dativ-, Genitiv- und Wechselpräpositionen" },
  { id: "09-praeteritum-plusquamperfekt", title: "Das Präteritum und Plusquamperfekt", description: "Regelmäßige und unregelmäßige Formen, Zeitformen im Vergleich" },
  { id: "10-konjunktiv2", title: "Der Konjunktiv II", description: "Höfliche Bitten, unrealische Bedingungen, Wünsche und Ratschläge" },
  { id: "11-passiv", title: "Passiv und unpersönliche Konstruktionen", description: "Vorgangs- und Zustandspassiv, man-Konstruktionen" },
  { id: "12-relativsaetze", title: "Relativsätze und komplexe Strukturen", description: "Relativpronomen, Genitiv, indirekte Rede, Infinitivkonstruktionen" },
];

export const loadedSections: Section[] = loadSectionsFromDsl("de", meta);
