import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://solva-trade.vercel.app"),
  title: "Solva Trade",
  description: "Run Your Business Smarter.",
  icons: {
    icon: "/solva-trade-icon.png",
    shortcut: "/solva-trade-icon.png",
    apple: "/solva-trade-icon.png",
  },
  openGraph: {
    title: "Solva Trade",
    description: "Run Your Business Smarter.",
    images: ["/solva-trade-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50">{children}</body>
    </html>
  );
}
