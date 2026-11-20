import type { Metadata } from "next";
import { MySpace } from "@/components/views/MySpace";
export const metadata: Metadata = { title: "Mon espace" };
export default function Page() {
  return <MySpace />;
}
