import type { Metadata, Viewport } from "next";
import { DisableNumberWheel } from "@/components/disable-number-wheel";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.solvatrade.co.ke"),
  applicationName: "Solva Trade",
  title: "Solva Trade",
  description: "Run Your Business Smarter.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Solva Trade",
  },
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

export const viewport: Viewport = {
  themeColor: "#03111f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50">
        {children}
        <DisableNumberWheel />
        <PwaRegister />
      </body>
    </html>
  );
}
