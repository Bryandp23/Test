import { Anton, Inter } from "next/font/google";

// Anton replaces Impact, which is missing on Android: titles now render the same everywhere.
export const displayFont = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-anton",
  display: "swap",
});

export const bodyFont = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

// Put both variables on <html>; globals.css reads them through --font-display / --font-body.
export const fontVariables = `${displayFont.variable} ${bodyFont.variable}`;
