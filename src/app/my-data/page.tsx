import { redirect } from "next/navigation";
import { getSession } from "~/next/lib/server-session";
import { sectionsIndex } from "~/content/sections";
import { buildSlotData } from "~/content/slots";
import { MyDataClient } from "./my-data-client";

export default async function MyDataPage() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/");
  }

  const { slotSections, ruleMeta } = buildSlotData();

  return (
    <MyDataClient
      sectionsIndex={sectionsIndex}
      slotSections={slotSections}
      ruleMeta={ruleMeta}
    />
  );
}
