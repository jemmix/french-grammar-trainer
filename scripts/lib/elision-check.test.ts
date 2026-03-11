import { describe, it, expect } from "vitest";
import {
  checkElision,
  startsWithVowelSound,
  startsWithConsonantSound,
  getTextBeforeBlank,
  getTextBeforeBlankElided,
  ASPIRATE_H,
} from "./elision-check.js";

describe("startsWithVowelSound", () => {
  it("returns true for words starting with vowels", () => {
    expect(startsWithVowelSound("aller")).toBe(true);
    expect(startsWithVowelSound("épeler")).toBe(true);
    expect(startsWithVowelSound("île")).toBe(true);
    expect(startsWithVowelSound("ordinateur")).toBe(true);
    expect(startsWithVowelSound("un")).toBe(true);
    expect(startsWithVowelSound("y")).toBe(true);
  });

  it("returns true for mute h words", () => {
    expect(startsWithVowelSound("homme")).toBe(true);
    expect(startsWithVowelSound("heure")).toBe(true);
    expect(startsWithVowelSound("histoire")).toBe(true);
    expect(startsWithVowelSound("habiter")).toBe(true);
  });

  it("returns false for aspirate h words", () => {
    expect(startsWithVowelSound("hibou")).toBe(false);
    expect(startsWithVowelSound("hache")).toBe(false);
    expect(startsWithVowelSound("honte")).toBe(false);
    expect(startsWithVowelSound("haricot")).toBe(false);
    expect(startsWithVowelSound("héros")).toBe(false);
  });

  it("returns false for consonant-starting words", () => {
    expect(startsWithVowelSound("vais")).toBe(false);
    expect(startsWithVowelSound("bonjour")).toBe(false);
    expect(startsWithVowelSound("maison")).toBe(false);
    expect(startsWithVowelSound("partir")).toBe(false);
  });

  it("handles empty/undefined", () => {
    expect(startsWithVowelSound("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(startsWithVowelSound("Aller")).toBe(true);
    expect(startsWithVowelSound("ALLER")).toBe(true);
    expect(startsWithVowelSound("Vais")).toBe(false);
  });
});

describe("startsWithConsonantSound", () => {
  it("returns opposite of startsWithVowelSound", () => {
    expect(startsWithConsonantSound("vais")).toBe(true);
    expect(startsWithConsonantSound("aller")).toBe(false);
    expect(startsWithConsonantSound("hibou")).toBe(true); // aspirate h
    expect(startsWithConsonantSound("homme")).toBe(false); // mute h
  });
});

describe("getTextBeforeBlank", () => {
  it("extracts word before space + ___", () => {
    expect(getTextBeforeBlank("Je ___")).toBe("Je");
    expect(getTextBeforeBlank("Tu ___ au travail")).toBe("Tu");
    expect(getTextBeforeBlank("« Je ___ à la pharmacie")).toBe("Je");
  });

  it("returns null if no match", () => {
    expect(getTextBeforeBlank("J'___")).toBe(null);
    expect(getTextBeforeBlank("No blank here")).toBe(null);
  });
});

describe("getTextBeforeBlankElided", () => {
  it("extracts word with apostrophe before ___", () => {
    expect(getTextBeforeBlankElided("J'___")).toBe("J'");
    expect(getTextBeforeBlankElided("« J'___ à la pharmacie")).toBe("J'");
    expect(getTextBeforeBlankElided("l'___")).toBe("l'");
    expect(getTextBeforeBlankElided("qu'___")).toBe("qu'");
  });

  it("returns null if no elided form before blank", () => {
    expect(getTextBeforeBlankElided("Je ___")).toBe(null);
    expect(getTextBeforeBlankElided("No blank")).toBe(null);
  });
});

describe("checkElision", () => {
  describe("elision-missing (should have elided but didn't)", () => {
    it("detects Je ___ with vowel-starting answers", () => {
      const issues = checkElision("Je ___", ["aller", "manger", "finir"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-missing");
      expect(issues[0]!.message.toLowerCase()).toContain("j'___");
    });

    it("detects le ___ with vowel-starting answers", () => {
      const issues = checkElision("le ___", ["homme", "ami"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-missing");
    });

    it("detects que ___ with vowel-starting answers", () => {
      const issues = checkElision("que ___", ["il", "elle", "on"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-missing");
    });

    it("detects all elision pairs", () => {
      const pairs = [
        { text: "je ___", answers: ["aime"] },
        { text: "me ___", answers: ["appelle"] },
        { text: "te ___", answers: ["entends"] },
        { text: "se ___", answers: ["appelle"] },
        { text: "le ___", answers: ["homme"] },
        { text: "la ___", answers: ["amie"] },
        { text: "de ___", answers: ["argent"] },
        { text: "ne ___", answers: ["aime"] },
        { text: "que ___", answers: ["il"] },
        { text: "ce ___", answers: ["est"] },
      ];

      for (const { text, answers } of pairs) {
        const issues = checkElision(text, answers);
        expect(issues, `Expected issue for "${text}"`).toHaveLength(1);
        expect(issues[0]!.kind).toBe("elision-missing");
      }
    });

    it("allows Je ___ when ALL answers start with consonant", () => {
      const issues = checkElision("Je ___", ["vais", "dois", "peux"]);
      expect(issues).toHaveLength(0);
    });

    it("detects issue when SOME answers start with vowel", () => {
      const issues = checkElision("Je ___", ["vais", "aime"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-missing");
    });
  });

  describe("elision-wrong (should NOT have elided but did)", () => {
    it("detects J'___ with consonant-starting answers", () => {
      const issues = checkElision("J'___", ["vais", "peux", "dois"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-wrong");
      expect(issues[0]!.message.toLowerCase()).toContain("je ___");
    });

    it("detects l'___ with consonant-starting answers", () => {
      const issues = checkElision("l'___", ["chat", "chien"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-wrong");
    });

    it("detects qu'___ with consonant-starting answers", () => {
      const issues = checkElision("qu'___", ["tu", "nous", "vous"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-wrong");
    });

    it("allows J'___ when ALL answers start with vowel", () => {
      const issues = checkElision("J'___", ["aime", "adore", "écoute"]);
      expect(issues).toHaveLength(0);
    });

    it("detects issue when SOME answers start with consonant", () => {
      const issues = checkElision("J'___", ["aime", "vais"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-wrong");
    });
  });

  describe("real-world question 01-04-016", () => {
    it("detects the bug: J'___ with consonant-starting 'vais'", () => {
      const issues = checkElision("« J'___ à la pharmacie acheter des médicaments. »", [
        "vais",
        "envoie",
        "allais",
        "viens",
      ]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-wrong");
      expect(issues[0]!.message.toLowerCase()).toContain("je ___");
    });
  });

  describe("aspirate h handling", () => {
    it("allows le ___ before aspirate h words (no elision needed)", () => {
      const issues = checkElision("le ___", ["hibou", "haricot"]);
      expect(issues).toHaveLength(0);
    });

    it("flags l'___ before aspirate h words (elision wrong)", () => {
      const issues = checkElision("l'___", ["hibou", "haricot"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-wrong");
    });
  });

  describe("mixed answer scenarios", () => {
    it("is strict: both vowel and consonant answers means either form is wrong", () => {
      const vowelIssues = checkElision("Je ___", ["vais", "aime"]);
      expect(vowelIssues).toHaveLength(1);
      expect(vowelIssues[0]!.kind).toBe("elision-missing");

      const elidedIssues = checkElision("J'___", ["vais", "aime"]);
      expect(elidedIssues).toHaveLength(1);
      expect(elidedIssues[0]!.kind).toBe("elision-wrong");
    });
  });

  describe("edge cases", () => {
    it("handles guillemets and punctuation", () => {
      const issues = checkElision("« J'___ à la pharmacie. »", ["vais"]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-wrong");
    });

    it("handles empty answers array", () => {
      const issues = checkElision("Je ___", []);
      expect(issues).toHaveLength(0);
    });

    it("handles whitespace in answers", () => {
      const issues = checkElision("J'___", ["  vais  "]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe("elision-wrong");
    });

    it("handles lowercase/uppercase in prompt", () => {
      const upper = checkElision("J'___", ["vais"]);
      const lower = checkElision("j'___", ["vais"]);
      expect(upper).toHaveLength(1);
      expect(lower).toHaveLength(1);
    });
  });
});
