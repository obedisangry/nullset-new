import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  description:
    "An interactive simulation of a zero-knowledge privacy pool. No real wallets, funds or blockchain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} h-full`}>
      <body className="min-h-full font-sans text-ns-text antialiased">{children}</body>
    </html>
  );
}
