import type { Metadata } from "next";
import { Settings } from "@/components/views/Settings";
export const metadata: Metadata = { title: "Paramètres" };
export default function Page() {
  return <Settings />;
}
