import { sectionsIndex } from "~/content/sections";
import { HomeClient } from "./home-client";

export default function Home() {
  return <HomeClient sections={sectionsIndex} />;
}
