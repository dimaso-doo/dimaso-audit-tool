import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dimaso Diagnosis Engine",
  description: "Website diagnosis and rebuild scope MVP for Dimaso"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
