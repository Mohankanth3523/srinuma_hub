import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SRINUMA HUB | CRM",
  description: "Srinuma Digital Solutions - CRM dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
