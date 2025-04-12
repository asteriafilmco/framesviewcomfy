import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./styles.scss";
import "./globals.css";
import { ViewComfyProvider } from "./providers/view-comfy-provider";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Frames",
  description: "Visual UI for ComfyUI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <ViewComfyProvider>
            {children}
            <Toaster />
          </ViewComfyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
