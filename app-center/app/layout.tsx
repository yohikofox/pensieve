import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pensine App Center",
  description: "Distribution interne des builds Android (APK) de Pensine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased min-h-screen bg-gray-50" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
