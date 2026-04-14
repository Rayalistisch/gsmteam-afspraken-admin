import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { Suspense } from "react";
import AppBridgeInit from "./components/AppBridgeInit";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "GSM Team Afspraken",
  description: "Developed by LuminX",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GSM Team",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body
        className={`${poppins.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <AppBridgeInit />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
