import type { RuleExplanation } from "../../types";

const explanations: RuleExplanation[] = [
  {
    ruleId: "01-01",
    title: "Conjugaison des verbes réguliers en -er (parler, manger, commencer, etc.)",
    body: "Les verbes en **-er** forment le groupe le plus important des verbes français (environ 90% des verbes). Ils suivent une conjugaison régulière au présent de l'indicatif. On retire la terminaison **-er** de l'infinitif et on ajoute les terminaisons : **-e, -es, -e, -ons, -ez, -ent**. Toutes les personnes ont le même radical, et la prononciation est identique pour je, tu, il, ils (le -e et -ent ne se prononcent pas).",
    examples: [
      "Je parl**e**, tu parl**es**, il/elle parl**e**, nous parl**ons**, vous parl**ez**, ils/elles parl**ent**",
      "Je mang**e**, tu mang**es**, il/elle mang**e**, nous mang**ons**, vous mang**ez**, ils/elles mang**ent**",
      "Je travaill**e** tous les jours. / Nous travaill**ons** ensemble. / Ils travaill**ent** bien."
    ]
  },
  {
    ruleId: "01-02",
    title: "Conjugaison des verbes réguliers en -ir (finir, choisir, réussir, etc.)",
    body: "Les verbes réguliers en **-ir** se conjuguent avec l'ajout de **-iss-** entre le radical et la terminaison aux personnes du pluriel (nous, vous, ils/elles). Les terminaisons sont : **-is, -is, -it, -issons, -issez, -issent**. Attention : tous les verbes en -ir ne sont pas réguliers (partir, sortir, dormir sont irréguliers et n'ont pas le -iss-).",
    examples: [
      "Je fin**is**, tu fin**is**, il fin**it**, nous fin**issons**, vous fin**issez**, ils fin**issent**",
      "Je choisis mon repas. / Nous choisissons ensemble. / Ils choisissent bien.",
      "Elle réussit à son examen. / Nous réussissons toujours."
    ]
  },
  {
    ruleId: "01-03",
    title: "Conjugaison des verbes réguliers en -re (attendre, vendre, répondre, etc.)",
    body: "Les verbes réguliers en **-re** forment un groupe plus restreint. On retire **-re** de l'infinitif et on ajoute les terminaisons : **-s, -s, -t, -ons, -ez, -ent**. Le radical reste le même à toutes les personnes. À la troisième personne du singulier, on ajoute **-t** (ou rien si le verbe se termine déjà par -t comme « battre » → il bat).",
    examples: [
      "J'atten**ds**, tu atten**ds**, il atten**d**, nous atten**dons**, vous atten**dez**, ils atten**dent**",
      "Je ven**ds** ma voiture. / Nous vend**ons** notre maison. / Ils vend**ent** tout.",
      "Je répon**ds** à l'email. / Elle répon**d** vite. / Vous répon**dez** poliment."
    ]
  },
  {
    ruleId: "01-04",
    title: "Les verbes irréguliers du 1er groupe (aller, envoyer)",
    body: "Bien que **aller** et **envoyer** se terminent en **-er**, ils sont irréguliers. **Aller** est particulièrement irrégulier : son radical change complètement (je **vais**, tu **vas**, il **va**, nous **allons**, vous **allez**, ils **vont**). **Envoyer** change son radical au futur et conditionnel (j'enverrai) mais reste régulier au présent, sauf qu'il suit le pattern des verbes en -yer.",
    examples: [
      "Je **vais** à Paris. / Tu **vas** bien ? / Il **va** travailler. / Nous **allons** au cinéma.",
      "Vous **allez** partir quand ? / Ils **vont** arriver demain.",
      "J'**envoie** un email. / Nous **envoyons** le colis. / Ils **envoient** une carte."
    ]
  },
  {
    ruleId: "01-05",
    title: "Les verbes irréguliers courants : être, avoir, faire, dire",
    body: "Ces quatre verbes sont parmi les plus utilisés en français et sont totalement irréguliers. **Être** : je suis, tu es, il est, nous sommes, vous êtes, ils sont. **Avoir** : j'ai, tu as, il a, nous avons, vous avez, ils ont. **Faire** : je fais, tu fais, il fait, nous faisons, vous faites, ils font. **Dire** : je dis, tu dis, il dit, nous disons, vous dites, ils disent. Attention à la forme « vous dites » (pas « disez »).",
    examples: [
      "Je **suis** étudiant. / Nous **sommes** en retard. / Vous **êtes** gentils.",
      "J'**ai** faim. / Tu **as** un chat. / Ils **ont** une voiture.",
      "Je **fais** la cuisine. / Nous **faisons** du sport. / Ils **font** attention.",
      "Je **dis** la vérité. / Vous **dites** que c'est facile. / Ils **disent** au revoir."
    ]
  },
  {
    ruleId: "01-06",
    title: "Les verbes irréguliers courants : pouvoir, vouloir, devoir, savoir",
    body: "Ces verbes modaux ont des radicaux irréguliers. **Pouvoir** (je peux, tu peux, il peut, nous pouvons, vous pouvez, ils peuvent). **Vouloir** (je veux, tu veux, il veut, nous voulons, vous voulez, ils veulent). **Devoir** (je dois, tu dois, il doit, nous devons, vous devez, ils doivent). **Savoir** (je sais, tu sais, il sait, nous savons, vous savez, ils savent). Ces verbes expriment la capacité, la volonté, l'obligation ou la connaissance.",
    examples: [
      "Je **peux** t'aider. / Nous **pouvons** venir. / Ils **peuvent** partir.",
      "Je **veux** un café. / Elle **veut** voyager. / Vous **voulez** quoi ?",
      "Je **dois** partir. / Tu **dois** étudier. / Nous **devons** travailler.",
      "Je **sais** nager. / Il **sait** la réponse. / Ils **savent** cuisiner."
    ]
  },
  {
    ruleId: "01-07",
    title: "Les verbes irréguliers courants : venir, tenir, prendre, mettre",
    body: "**Venir** et **tenir** sont conjugués de façon similaire : je viens/tiens, tu viens/tiens, il vient/tient, nous venons/tenons, vous venez/tenez, ils viennent/tiennent. **Prendre** : je prends, tu prends, il prend, nous prenons, vous prenez, ils prennent. **Mettre** : je mets, tu mets, il met, nous mettons, vous mettez, ils mettent. Ces verbes servent aussi de base à de nombreux verbes composés (devenir, revenir, apprendre, comprendre, promettre, etc.).",
    examples: [
      "Je **viens** de Paris. / Nous **venons** vous voir. / Ils **viennent** demain.",
      "Je **tiens** le livre. / Elle **tient** sa promesse. / Ils **tiennent** le shop.",
      "Je **prends** le bus. / Nous **prenons** un café. / Ils **prennent** leur temps.",
      "Je **mets** mon manteau. / Vous **mettez** la table. / Elles **mettent** du temps."
    ]
  },
  {
    ruleId: "01-08",
    title: "Les verbes irréguliers courants : voir, croire, boire, écrire, lire",
    body: "**Voir** : je vois, tu vois, il voit, nous voyons, vous voyez, ils voient. **Croire** : je crois, tu crois, il croit, nous croyons, vous croyez, ils croient. **Boire** : je bois, tu bois, il boit, nous buvons, vous buvez, ils boivent (radical change au pluriel). **Écrire** : j'écris, tu écris, il écrit, nous écrivons, vous écrivez, ils écrivent. **Lire** : je lis, tu lis, il lit, nous lisons, vous lisez, ils lisent.",
    examples: [
      "Je **vois** mes amis. / Nous **voyons** un film. / Ils **voient** le problème.",
      "Je **crois** que oui. / Vous **croyez** en lui. / Elles **croient** à la chance.",
      "Je **bois** de l'eau. / Nous **buvons** du vin. / Ils **boivent** du café.",
      "J'**écris** une lettre. / Elle **écrit** bien. / Ils **écrivent** un livre.",
      "Je **lis** le journal. / Tu **lis** beaucoup. / Ils **lisent** des romans."
    ]
  },
  {
    ruleId: "01-09",
    title: "Les verbes en -yer (payer, essayer, envoyer, nettoyer)",
    body: "Les verbes en **-yer** (payer, essayer, nettoyer, employer, envoyer) transforment le **y** en **i** devant un **e** muet. Cela affecte les personnes : je, tu, il, ils. Les formes avec nous et vous gardent le **y** (nous payons, vous payez). Il existe souvent deux orthographes acceptées : « je paie » ou « je paye ». Les verbes en -ayer acceptent les deux formes ; les verbes en -oyer et -uyer n'acceptent que la forme en i.",
    examples: [
      "Je **paie** / **paye** l'addition. / Tu **essaies** / **essayes**. / Ils **paient**.",
      "Je **nettoie** ma chambre. / Nous **nettoyons** la maison. / Ils **nettoient**.",
      "J'**emploie** ce mot. / Vous **employez** cette technique. / Ils **emploient**.",
      "J'**essaie** de comprendre. / Nous **essayons** encore. / Elles **essaient**."
    ]
  },
  {
    ruleId: "01-10",
    title: "Les verbes en -eler/-eter (appeler, jeter) et les doubles consonnes",
    body: "Pour les verbes en **-eler** et **-eter**, la consonne **l** ou **t** double devant un **e** muet (je, tu, il, ils). Exemples : j'appelle, je jette. Cependant, les verbes qui ont un accent grave au futur (comme acheter, mener) ne doublent pas la consonne mais changent **e** en **è** : j'achète, je mène. Les formes avec nous et vous gardent la consonne simple (nous appelons, nous jetons).",
    examples: [
      "J'**appelle** mes parents. / Tu **appelles**. / Il **appelle**. / Nous **appelons**.",
      "Je **jette** les déchets. / Vous **jetez** ça. / Ils **jettent** tout.",
      "J'**achète** du pain (pas *j'achette*). / Nous **achetons** une maison.",
      "Je **mène** bien mon projet. / Tu **mènes** l'enquête. / Ils **mènent** l'équipe."
    ]
  },
  {
    ruleId: "01-11",
    title: "Les verbes en -cer et -ger (commencer, manger) — cédille et e intercalaire",
    body: "Pour garder une prononciation douce du **c** et du **g** devant les voyelles **a, o, u**, on utilise des adaptations orthographiques. Pour les verbes en **-cer** : on ajoute une **cédille** (ç) devant a (nous commençons). Pour les verbes en **-ger** : on ajoute un **e** après g devant a et o (nous mangeons). Ces modifications n'affectent que les formes avec nous (et parfois vous pour les verbes en -ger).",
    examples: [
      "Je **commence**. / Nous **commençons** (cédille). / Ils **commencent**.",
      "Je **mange**. / Nous **mangeons** (e intercalaire). / Vous **mangez**.",
      "Je **place** le livre. / Nous **plaçons** le meuble. / Elles **placent**.",
      "Je **nage** bien. / Nous **nageons** chaque jour. / Ils **nagent**."
    ]
  },
  {
    ruleId: "01-12",
    title: "Les verbes pronominaux au présent (se lever, se souvenir, s'asseoir)",
    body: "Les verbes pronominaux se conjuguent avec un pronom réfléchi (**me, te, se, nous, vous, se**) qui s'accorde avec le sujet. Le pronom se place devant le verbe. À l'infinitif et après un autre verbe conjugué, le pronom reste à l'infinitif (je vais **me** lever). Attention à l'accord du participe passé au passé composé : elle s'est lavé**e** (accord avec le sujet). Le verbe s'asseoir a deux conjugaisons acceptées.",
    examples: [
      "Je **me** lève à 7h. / Tu **te** lèves tôt. / Il **se** lève. / Nous **nous** levons.",
      "Je **me** souviens de toi. / Nous **nous** souvenons bien. / Ils **se** souviennent.",
      "Je **m'assois** / **m'assieds**. / Tu **t'assois** / **t'assieds**. / Nous **nous asseyons**.",
      "Elle **se** brosse les dents. / Vous **vous** couchez tard."
    ]
  },
  {
    ruleId: "01-13",
    title: "Les verbes pronominaux réciproques (se parler, se regarder, se téléphoner)",
    body: "Les verbes pronominaux réciproques expriment une action échangée entre plusieurs sujets. Le pronom réfléchi signifie « l'un l'autre » ou « les uns les autres ». On les utilise uniquement avec des sujets pluriels (nous, vous, ils/elles). Le verbe s'accorde normalement. Ces verbes impliquent une réciprocité : ils se regardent = ils regardent l'un l'autre.",
    examples: [
      "Nous **nous parlons** tous les jours. / Vous **vous parlez** souvent. / Ils **se parlent**.",
      "Ils **se regardent** avec admiration. / Elles **se regardent** dans le miroir.",
      "Nous **nous téléphonons** le dimanche. / Ils **se téléphonent** pour les nouvelles.",
      "Les étudiants **s'entraident** pendant les examens. / Elles **s'écrivent** des lettres."
    ]
  },
  {
    ruleId: "01-14",
    title: "Le présent pour exprimer une habitude ou une vérité générale",
    body: "Le présent de l'indicatif exprime des **habitudes** (actions répétées régulièrement) et des **vérités générales** (faits toujours vrais). Les marqueurs temporels fréquents incluent : tous les jours, chaque matin, d'habitude, généralement, souvent, toujours. Ces phrases décrivent des situations permanentes ou des routines, pas des actions ponctuelles.",
    examples: [
      "Je **vais** au travail tous les jours. / Elle **prend** le bus chaque matin.",
      "Les Français **mangent** du fromage. / L'eau **bout** à 100 degrés.",
      "Le soleil **se lève** à l'est. / La Terre **tourne** autour du Soleil.",
      "D'habitude, je **dîne** à 19h. / Généralement, nous **travaillons** ensemble."
    ]
  },
  {
    ruleId: "01-15",
    title: "Le présent pour exprimer une action en cours",
    body: "Le présent peut décrire une action **en cours de déroulement** au moment où l'on parle. Pour insister sur l'action en cours, on utilise souvent la tournure **« être en train de » + infinitif**. Le présent continu s'oppose au présent habituel : « Je lis » (habitude) vs « Je suis en train de lire » (action en cours maintenant).",
    examples: [
      "Je **suis en train de** travailler. / Qu'est-ce que tu **fais** là ?",
      "Il **pleut** en ce moment. / Elle **dort** encore.",
      "Les enfants **jouent** dans le jardin. / Nous **regardons** la télé.",
      "Attends, je **m'habille**. / Le train **arrive**. / Le téléphone **sonne**."
    ]
  },
  {
    ruleId: "01-16",
    title: "Le présent à valeur de futur proche (je pars demain)",
    body: "Le présent peut exprimer le **futur proche** quand l'action est certaine et programmée dans un avenir immédiat. On l'utilise souvent avec des expressions de temps futur : demain, la semaine prochaine, dans deux jours, ce soir, l'année prochaine. C'est très courant à l'oral et dans le langage familier. Le présent de futur se distingue du futur proche (aller + infinitif) par son côté plus direct.",
    examples: [
      "Je **pars** demain matin. / Le train **arrive** dans 10 minutes.",
      "La réunion **commence** à 14h. / Nous **partons** en vacances la semaine prochaine.",
      "Le concert **est** ce soir. / Elle **arrive** demain.",
      "Le film **passe** samedi à 20h. / Les vacances **commencent** lundi."
    ]
  },
  {
    ruleId: "01-17",
    title: "Le présent dans les constructions avec depuis / il y a...que / ça fait...que",
    body: "Avec **depuis**, **il y a...que**, et **ça fait...que**, le présent exprime une action qui a commencé dans le passé et **continue encore** dans le présent. On n'utilise PAS le passé composé avec ces expressions pour une action encore en cours. **Depuis** + point de départ (depuis 2020) ou **depuis** + durée (depuis trois ans). Ces constructions insistent sur la durée de l'action.",
    examples: [
      "J'habite ici **depuis** trois ans. / **Il y a** trois ans que j'habite ici.",
      "**Ça fait** longtemps que je t'attends. / Elle travaille là **depuis** 2019.",
      "**Depuis** combien de temps apprenez-vous le français ?",
      "Je **suis** fatigué **depuis** ce matin. / Nous nous connaissons **depuis** l'enfance."
    ]
  },
  {
    ruleId: "01-18",
    title: "Le présent de narration (usage littéraire/journalistique)",
    body: "Le **présent de narration** (ou présent historique) est utilisé dans les récits pour rendre les événements passés plus vivants. Bien que les faits se soient passés dans le passé, on les raconte au présent pour créer un effet d'immédiateté. C'est fréquent dans la littérature, le journalisme, les résumés de films ou de livres, et les commentaires sportifs.",
    examples: [
      "Napoléon **entre** dans Paris en 1814. Puis il **part** pour l'île d'Elbe.",
      "C'est alors que le héros **découvre** la vérité. Il **court** vers la sortie.",
      "Le film **commence** en 1945. Un homme **marche** dans la rue.",
      "Mbappé **reçoit** le ballon, il **dribble** le défenseur, il **tire**... et c'est le but !"
    ]
  },
  {
    ruleId: "01-19",
    title: "Les verbes impersonnels au présent (il faut, il pleut, il s'agit de)",
    body: "Les verbes impersonnels se conjuguent uniquement à la troisième personne du singulier (**il**). Ils n'ont pas de sujet réel. Les plus courants : **il faut** (nécessité), **il y a** (existence), **il pleut / neige** (météo), **il s'agit de** (il est question de), **il arrive** (événement), **il reste** (ce qui demeure). **Falloir** n'existe qu'à l'impersonnel. Ces verbes expriment des états ou des événements généraux.",
    examples: [
      "**Il faut** partir maintenant. / **Il faut que** tu viennes (avec subjonctif).",
      "**Il y a** beaucoup de monde. / **Il n'y a** rien à faire.",
      "**Il pleut** aujourd'hui. / **Il neige** en montagne. / **Il fait** beau.",
      "**Il s'agit** d'une erreur. / **Il reste** deux places. / **Il arrive** souvent."
    ]
  },
  {
    ruleId: "01-20",
    title: "Les verbes à construction particulière : plaire, falloir, manquer, suffire",
    body: "Ces verbes ont des constructions syntaxiques particulières. **Plaire** : quelque chose **plaît à** quelqu'un (ce livre me plaît). **Falloir** : impersonnel uniquement (il faut + infinitif ou il faut que + subjonctif). **Manquer** : inversion du sujet logique (elle me manque = I miss her). **Suffire** : quelque chose **suffit à** / **suffit pour** (ça suffit pour aujourd'hui). Ces constructions diffèrent souvent de l'anglais.",
    examples: [
      "Ce film **me plaît** beaucoup. / Cette musique **te plaît** ? / Ça **leur plaît**.",
      "**Il faut** travailler. / **Il faut que** tu partes. / **Il me faut** du temps.",
      "Ma famille **me manque**. / Tu **manques** à tes amis. / L'argent **lui manque**.",
      "Ça **suffit**. / Une heure **suffit**. / Ça **suffira** pour aujourd'hui."
    ]
  },
];

export default explanations;
