import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vellura Dental — Luxury dentistry, effortlessly booked",
  description:
    "Vellura Dental is a luxury dental clinic. Arrange your visit in moments with our AI concierge.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      {/* Browser extensions often add attributes to <body>; ignore them during hydration. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
