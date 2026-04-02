import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Kinetic Workspace",
  description: "Lightweight project and task management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
