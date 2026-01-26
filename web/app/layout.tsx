import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pensine - Capturez vos pensées",
  description: "Pensine est une application mobile qui vous permet de capturer, transcrire et organiser vos pensées vocales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
