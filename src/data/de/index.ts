import type { Section, SectionMeta } from "../types";
import section01 from "./01-artikel-genus";
import section02 from "./02-akkusativ";
import section03 from "./03-dativ";
import section04 from "./04-praesens";
import section05 from "./05-perfekt";
import section06 from "./06-adjektivdeklination";
import section07 from "./07-wortstellung-konjunktionen";
import section08 from "./08-praepositionen";
import section11 from "./11-passiv";
import section12 from "./12-relativsaetze";

export const loadedSections: Section[] = [section01, section02, section03, section04, section05, section06, section07, section08, section11, section12];

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
