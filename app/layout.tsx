import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "D&D Management",
  description: "Order entry and reporting for D&D workflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <Navbar />
        <main className="grow min-h-0 min-w-0">{children}</main>
      </body>
    </html>
  );
}
