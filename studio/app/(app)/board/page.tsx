import type { Metadata } from "next";
import { Board } from "@/components/board/Board";
export const metadata: Metadata = { title: "Board visuel" };
export default function BoardPage() {
  return <Board />;
}
