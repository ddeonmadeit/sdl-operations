import type { Metadata, Viewport } from "next";
import { OfflineBanner, Toaster } from "@/components/client";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SDL Creations", template: "%s · SDL" },
  description: "SDL Creations operations – office and site.",
  applicationName: "SDL Creations",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SDL", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e7ded3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="min-h-dvh">
        {children}
        <Toaster />
        <OfflineBanner />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
