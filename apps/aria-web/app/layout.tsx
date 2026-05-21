import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "aria",
  description:
    "aria - Tula's web dashboard. Browse health data ingested from email, with live updates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
