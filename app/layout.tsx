import type { Metadata } from "next"
import { Manrope } from "next/font/google"

import "./globals.css"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-headline",
  display: "swap",
})

const manropeBody = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Appraisify",
  description: "Performance appraisals, simplified.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${manropeBody.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-body text-foreground">{children}</body>
    </html>
  )
}
