import type { Metadata } from "next";
import "./globals.css";
import AutoLogout from "@/app/components/AutoLogout";

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
      <body className="antialiased">
        <AutoLogout />
        {children}
      </body>
    </html>
  );
}
