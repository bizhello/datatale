import type { Metadata } from "next";
import { Noto_Sans, Noto_Serif_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

const bodyFont = Noto_Sans({
  subsets: ["cyrillic", "latin"],
  variable: "--font-body",
  display: "swap",
  preload: true,
});

const displayFont = Noto_Serif_Display({
  subsets: ["cyrillic", "latin"],
  variable: "--font-display",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "DataTale — превратите данные в историю",
  description: "Загрузите данные и проверьте источник перед анализом.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
