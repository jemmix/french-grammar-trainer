import { sectionsIndex } from "~/data/sections-index";
import { HomeClient } from "./home-client";

export default function Home() {
  return <HomeClient sections={sectionsIndex} />;
}
