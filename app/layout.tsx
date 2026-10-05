import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Routine — Job search command center",
  description: "A focused daily dashboard for building job-search momentum.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
