import { redirect } from "next/navigation";
import { getSession } from "~/lib/server-session";
import { MyDataClient } from "./my-data-client";

export default async function MyDataPage() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/");
  }
  return <MyDataClient />;
}
