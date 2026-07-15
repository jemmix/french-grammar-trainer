import { sectionsIndex, sectionMap } from "./sections";

export interface SlotInfo {
  ruleId: string;
  ruleTitle: string | null;
  slotIdx: number;
  sectionNum: number;
  ruleNum: number;
  sectionTitle: string | null;
}

export interface SlotSection {
  sectionNum: number;
  title: string | null;
  slots: SlotInfo[];
}

export interface RuleMetaEntry {
  title: string;
  sectionId: string;
  sectionTitle: string;
}

export interface SlotData {
  slotSections: SlotSection[];
  ruleMeta: Map<string, RuleMetaEntry>;
}

export function buildSlotData(): SlotData {
  const allSlots: SlotInfo[] = Array.from({ length: 28 }, (_, sIdx) => {
    const sectionNum = sIdx + 1;
    const sectionMeta = sectionsIndex[sIdx];
    const loadedSection = sectionMeta ? sectionMap[sectionMeta.id] : undefined;
    return Array.from({ length: 20 }, (_, rIdx) => {
      const ruleNum = rIdx + 1;
      const ruleId = `${String(sectionNum).padStart(2, "0")}-${String(ruleNum).padStart(2, "0")}`;
      const ruleTitle = loadedSection?.rules.find((r) => r.id === ruleId)?.title ?? null;
      return {
        ruleId,
        ruleTitle,
        slotIdx: sIdx * 20 + rIdx,
        sectionNum,
        ruleNum,
        sectionTitle: sectionMeta?.title ?? null,
      };
    });
  }).flat();

  const slotSections: SlotSection[] = Array.from({ length: 28 }, (_, sIdx) => ({
    sectionNum: sIdx + 1,
    title: sectionsIndex[sIdx]?.title ?? null,
    slots: allSlots.slice(sIdx * 20, sIdx * 20 + 20),
  }));

  const ruleMeta = new Map<string, RuleMetaEntry>(
    Object.values(sectionMap).flatMap((section) =>
      section.rules.map((rule) => [
        rule.id,
        {
          title: rule.title,
          sectionId: rule.sectionId,
          sectionTitle: section.title,
        },
      ]),
    ),
  );

  return { slotSections, ruleMeta };
}
