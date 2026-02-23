import type { Section, SectionMeta } from "./types";
import section01 from "./sections/01-present-indicatif";
import section02 from "./sections/02-passe-compose";
import section03 from "./sections/03-imparfait";
import section04 from "./sections/04-plus-que-parfait";
import section05 from "./sections/05-futur-simple-et-anterieur";
import section06 from "./sections/06-conditionnel";
import section07 from "./sections/07-subjonctif-present";
import section08 from "./sections/08-subjonctif-passe";
import section10 from "./sections/10-articles";

// Add compiled section files here — counts and availability are derived automatically.
const _loadedSections: Section[] = [section01, section02, section03, section04, section05, section06, section07, section08, section10];

export const sectionMap: Record<string, Section> = Object.fromEntries(
  _loadedSections.map((s) => [s.id, s]),
);

const _questionCounts = new Map(_loadedSections.map((s) => [s.id, s.questions.length]));

const _meta: Omit<SectionMeta, "questionCount">[] = [
  { id: "01-present-indicatif", title: "Le présent de l'indicatif", description: "Conjugaison régulière et irrégulière, verbes pronominaux, emplois du présent" },
  { id: "02-passe-compose", title: "Le passé composé", description: "Formation avec avoir/être, accord du participe passé, choix de l'auxiliaire" },
  { id: "03-imparfait", title: "L'imparfait", description: "Formation, emplois, opposition passé composé/imparfait" },
  { id: "04-plus-que-parfait", title: "Le plus-que-parfait", description: "Formation, emplois, concordance des temps" },
  { id: "05-futur-simple-et-anterieur", title: "Le futur simple et le futur antérieur", description: "Formation régulière et irrégulière, emplois, antériorité" },
  { id: "06-conditionnel", title: "Le conditionnel présent et passé", description: "Politesse, hypothèse, information non confirmée, regret" },
  { id: "07-subjonctif-present", title: "Le subjonctif présent", description: "Formation, emplois après les verbes de volonté, sentiment, doute" },
  { id: "08-subjonctif-passe", title: "Le subjonctif passé", description: "Formation, emplois, opposition indicatif/subjonctif" },
  { id: "09-imperatif", title: "L'impératif", description: "Formation, place des pronoms, verbes pronominaux" },
  { id: "10-articles", title: "Les articles", description: "Articles définis, indéfinis, partitifs — emplois et distinctions" },
  { id: "11-pronoms-cod-coi", title: "Les pronoms personnels (COD, COI)", description: "Identification, place dans la phrase, double pronominalisation" },
  { id: "12-pronoms-relatifs", title: "Les pronoms relatifs", description: "Qui, que, dont, où, lequel, ce qui/ce que/ce dont" },
  { id: "13-demonstratifs-possessifs", title: "Les pronoms démonstratifs et possessifs", description: "Celui/celle, le mien/la mienne, c'est vs il est" },
  { id: "14-pronoms-indefinis", title: "Les pronoms indéfinis", description: "Tout, chaque, quelqu'un, personne, rien, aucun" },
  { id: "15-adjectifs", title: "Les adjectifs", description: "Accord en genre et nombre, place avant/après le nom" },
  { id: "16-comparatifs-superlatifs", title: "Les comparatifs et superlatifs", description: "Supériorité, infériorité, égalité, formes irrégulières" },
  { id: "17-adverbes", title: "Les adverbes", description: "Formation, place dans la phrase, adverbes courants" },
  { id: "18-negation", title: "La négation", description: "Ne...pas, plus, jamais, rien, personne, restriction ne...que" },
  { id: "19-interrogation", title: "L'interrogation", description: "Questions fermées et ouvertes, registres, interrogation indirecte" },
  { id: "20-prepositions", title: "Les prépositions", description: "À, de, en, dans, sur, pour, par — emplois et distinctions" },
  { id: "21-hypotheses", title: "Les hypothèses (si + temps)", description: "Si + présent/futur, imparfait/conditionnel, plus-que-parfait/conditionnel passé" },
  { id: "22-discours-indirect", title: "Le discours indirect", description: "Transformation, concordance des temps, changement de pronoms" },
  { id: "23-voix-passive", title: "La voix passive", description: "Formation, agent, transformation actif/passif" },
  { id: "24-connecteurs-logiques", title: "Les connecteurs logiques", description: "Cause, conséquence, opposition, but" },
  { id: "25-expression-temps", title: "L'expression du temps", description: "Depuis, pendant, pour, il y a, en, dans" },
  { id: "26-gerondif-participe", title: "Le gérondif et le participe présent", description: "Formation, emplois, distinction participe/adjectif verbal" },
  { id: "27-gallicismes", title: "Les gallicismes", description: "Futur proche, passé récent, présent continu" },
  { id: "28-accord-participe-avance", title: "L'accord du participe passé (cas avancés)", description: "COD antéposé, verbes pronominaux, participe + infinitif" },
];

export const sectionsIndex: SectionMeta[] = _meta.map((m) => ({
  ...m,
  questionCount: _questionCounts.get(m.id) ?? 0,
}));
