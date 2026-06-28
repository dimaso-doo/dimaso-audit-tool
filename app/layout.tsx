import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dimaso Audit Tool",
  description: "External public website audit MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
