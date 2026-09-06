import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Groundcheck — verify AI study answers against the real textbook",
  description:
    "Paste an AI-generated study answer and Groundcheck verifies it claim by claim against your real textbook PDF — confirmed, contradicted, or unsupported, with a glowing highlight box on the exact page.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}