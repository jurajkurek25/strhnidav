import type { Metadata } from "next";
import { Fraunces, Big_Shoulders, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "500", "600"],
  style: ["normal", "italic"],
});

const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Strhni Dav — členská sekcia",
  description: "Denný kurz psychológie osobnosti Strhni Dav.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <body
        className={`${fraunces.variable} ${bigShoulders.variable} ${inter.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
