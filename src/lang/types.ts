// LangStrings — every UI string in the app, keyed by domain.
// Every language bundle must implement this interface (use `satisfies LangStrings`).

export interface TierStrings {
  label: string;
  promo: string;
}

// A privacy policy paragraph is either plain text or text containing one link.
export type PrivacySectionPara =
  | string
  | { before: string; linkText: string; linkHref: string; after: string };

export interface PrivacySection {
  num: string;
  title: string;
  titleCode?: string; // if set, rendered as: {title} <code>{titleCode}</code>
  paras: PrivacySectionPara[];
}

export interface LangStrings {
  // ── Meta ──────────────────────────────────────────────────────────────────
  meta: {
    appName: string;         // "Grammaire Française"
    appTitle: string;        // "Grammaire Française B1" (used in <title> base)
    levelLabel: string;      // "Niveau B1"
    description: string;     // <meta name="description">
    langCode: string;        // "fr" | "en" (HTML lang attribute)
  };

  // ── Shared ────────────────────────────────────────────────────────────────
  shared: {
    back: string;            // "Retour"
    backToHome: string;      // "Retour à l'accueil"
    loading: string;         // "Chargement..."
    sections: string;        // "Sections" (nav back link in quiz)
  };

  // ── Home page ─────────────────────────────────────────────────────────────
  home: {
    heading: string;         // "Grammaire Française"
    subtitle: string;        // "Maîtrisez les règles..."
    learnFreelyTitle: string;
    learnFreelySubLogged: string;
    learnFreelySubAnon: string;
    startButton: string;     // "Commencer"
    comingSoon: string;      // "Bientôt"
    hiddenReveal: (n: number) => string;  // "+3 sections à venir"
    hiddenCollapse: string;  // "réduire"
    footerTagline: string;   // "Grammaire Française B1 — Entraînement interactif"
    privacyLink: string;     // "Confidentialité"
    myDataLink: string;      // "Mes données"
    logout: string;          // "Se déconnecter"
    signingOut: string;      // "Déconnexion…"
    login: string;           // "Se connecter"
  };

  // ── Quiz chrome ───────────────────────────────────────────────────────────
  quiz: {
    questionLabel: (n: number) => string;  // "Question 3"
    inputBadge: string;      // "saisie" (pill on input questions)
    nextButton: string;      // "Question suivante"
    enterHint: string;       // "Entrée ↵"
    submitButton: string;    // "Valider"
    correctAnswer: string;   // "Bonne réponse !"
    wrongAnswer: string;     // "Mauvaise réponse"
    correctAnswerLabel: string; // "La bonne réponse :"
    // Case warning: "Attention à la casse : la bonne écriture est « X », pas « Y »."
    caseWarningBefore: string;
    caseWarningAfter: string;
    // Typo-correct: "Vous vouliez probablement dire « X » — c'est la bonne réponse, mais l'orthographe compte !"
    typoCorrectBefore: string;
    typoCorrectAfter: string;
    // Typo-wrong: "Vous vouliez probablement dire « X » — c'est incorrect."
    typoWrongBefore: string;
    typoWrongAfter: string;
    unexpectedAnswer: string;           // "Réponse inattendue"
    unexpectedDetails: (input: string) => string;
    viewExplanation: string;             // "View explanation"
    closeExplanation: string;            // "Close"
    startPractice: string;               // "Start practice"

    interstitialIntro: string;           // "Review this rule before practicing:"
    examples: string;                    // "Examples"
    noExplanation: string;               // "No explanation available..."
    openInspectorTitle: string;          // tooltip on question ID link
    sectionNotFound: string;
    points: (n: number) => string;      // "3 pts"
    learnFreelyQuizTitle: string;       // used as quizTitle in ScoreSummary
  };

  // ── Score summary ─────────────────────────────────────────────────────────
  score: {
    resultTitle: (sectionTitle: string) => string;  // "Résultat — Les articles"
    gradeExcellent: string;
    gradeBien: string;
    gradeMoyenne: string;
    gradeRework: string;
    percentCorrect: (pct: number) => string;
    answerBreakdown: string;
    inputQuestionTitle: string;          // tooltip on the input dot
    questionLinkTitle: (id: string) => string;
    restart: string;
    chooseDifferentSection: string;
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  login: {
    pageTitle: string;
    heading: string;
    connectingState: string;
    intro: string;
    privacySummaryTitle: string;
    privacyBullets: readonly [string, string, string, string, string];
    dontShowAgain: string;
    loginButton: (inProgress: boolean) => string;
    stayAnonymous: string;
    devModeLabel: string;
    simulateDenied: string;
    learnMorePrefix: string;
    privacyPolicyLink: string;
  };

  // ── Privacy policy ────────────────────────────────────────────────────────
  privacy: {
    pageTitle: string;
    heading: string;
    myDataLinkText: string;   // link text in section 06
    sections: readonly PrivacySection[];
  };

  // ── My data ───────────────────────────────────────────────────────────────
  myData: {
    pageTitle: string;
    heading: string;
    identityTitle: string;
    identityDesc: string;
    rawDataTitle: string;
    rawDataDesc: string;
    blobLoading: string;
    noData: string;
    headerSectionLabel: string;    // "En-tête — 11 octets (offset 0)"
    tableField: string;
    tableType: string;
    tableOffset: string;
    tableValue: string;
    slotsLabel: (slots: number) => string;
    slotsDesc: string;
    sectionPrefix: string;         // "Section"
    jsonExportTitle: string;
    jsonExportDesc: string;
    downloadButton: string;
    deleteTitle: string;
    deleteDesc: string;
    deleteButton: string;
    deleteWarning: string;
    deleteConfirmButton: string;
    deletingLabel: string;
    cancelButton: string;
    exportFormat: string;          // machine ID in JSON export
    exportFilename: (date: string) => string;
  };

  // ── Denied page ───────────────────────────────────────────────────────────
  denied: {
    pageTitle: string;
    heading: string;
    body: string;
    idLabel: string;
  };

  // ── Goodbye page ──────────────────────────────────────────────────────────
  goodbye: {
    pageTitle: string;
    heading: string;
    body1: string;
    body2: string;
  };

  // ── Question review page ──────────────────────────────────────────────────
  questionReview: {
    pageTitle: (id: string) => string;
    questionNotFound: string;
    mcqBadge: string;        // "QCM"
    inputBadge: string;      // "Saisie"
    stmtLabel: string;       // "Énoncé" (prompt display header)
    consigneLabel: string;   // "Consigne" (instruction display header)
    testInputLabel: string;  // "Tester la saisie"
    choicesLabel: (n: number) => string;
    collapseAll: string;
    expandAll: string;
    permalink: string;
    copied: string;
    copyPermalinkTitle: string;
    prevQuestionTitle: (id: string) => string;
    nextQuestionTitle: (id: string) => string;
    submitButton: string;    // "Valider"
    retryButton: string;     // "Réessayer"
    correctAnswerDisclosure: string;
    wrongAnswersDisclosure: string;
    typoVariantsDisclosure: string;
    typoVariantsDesc: string;
    typoDistanceLabel: (len: number) => string;
    inputResultLabels: {
      exact: string;
      caseWarning: (answer: string) => string;
      wrongPrepared: (matched: string) => string;
      typoCorrect: (matched: string) => string;
      typoWrong: (matched: string) => string;
      unknown: (input: string) => string;
    };
  };

  // ── Tier labels & promos (6 tiers, index 0 = highest) ────────────────────
  // Must be in same order as TIER_THRESHOLDS in constants.ts.
  tiers: readonly [
    TierStrings, // mastered   (≥ 0.95)
    TierStrings, // veryAdv    (≥ 0.80)
    TierStrings, // advanced   (≥ 0.60)
    TierStrings, // interm     (≥ 0.40)
    TierStrings, // inProgress (≥ 0.20)
    TierStrings, // beginner   (≥ 0.00)
  ];

  // ── Phrase delimiters (wrap the fill-in-the-blank sentence) ─────────────
  phraseOpen: string;    // "«\u00a0" for FR, "\u201c" for EN
  phraseClose: string;   // "\u00a0»" for FR, "\u201d" for EN

  // ── aria-label for fill-in-the-blank span ─────────────────────────────────
  blankAriaLabel: string;   // "blanc" / "blank"
}
