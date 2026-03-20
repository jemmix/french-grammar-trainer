import { redirect } from "next/navigation";
import { getSession } from "~/lib/server-session";
import { sectionsIndex, sectionMap } from "~/data/sections-index";
import { MyDataClient, type SlotSection } from "./my-data-client";

export default async function MyDataPage() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/");
  }

  const allSlots = Array.from({ length: 28 }, (_, sIdx) => {
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

  const ruleMeta = new Map(
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

  return (
    <MyDataClient
      sectionsIndex={sectionsIndex}
      slotSections={slotSections}
      ruleMeta={ruleMeta}
    />
  );
}
