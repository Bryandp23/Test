import type { Metadata } from "next";
import { MediaLibrary } from "@/components/views/MediaLibrary";
export const metadata: Metadata = { title: "Médiathèque" };
export default function Page() {
  return <MediaLibrary />;
}
