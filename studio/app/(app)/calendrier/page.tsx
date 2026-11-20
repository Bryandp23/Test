import type { Metadata } from "next";
import { NotYet } from "@/components/views/NotYet";
export const metadata: Metadata = { title: "Calendrier" };
export default function Page() {
  return <NotYet view="calendrier" />;
}
