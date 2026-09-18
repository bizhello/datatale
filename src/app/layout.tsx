import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./theme-provider";

export const metadata: Metadata = {
  title: "DataTale — у данных есть история",
  description: "От сырых данных к понятной истории.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
