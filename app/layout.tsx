import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Groundcheck — is that AI answer true?",
  description:
    "Paste an AI-generated answer and see, claim by claim, whether it is confirmed, contradicted, or unsupported by your real textbook — with a highlight box on the exact page.",
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