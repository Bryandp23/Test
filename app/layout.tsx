import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EPHEC Calendar", template: "%s · EPHEC" },
  description: "Ajoutez votre formation EPHEC à votre calendrier en quelques secondes.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#27958F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-BE">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
