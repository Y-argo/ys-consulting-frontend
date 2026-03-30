import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASCEND",
  description: "Ys Consulting Office",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
