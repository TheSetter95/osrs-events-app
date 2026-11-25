import type { Metadata } from 'next'
import { Cinzel, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

// Lettertypen worden bij het bouwen opgehaald en vanaf onze eigen site geserveerd
// (sneller, en er worden geen bezoekersgegevens naar Google gestuurd).
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap',
})
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Massief Goud Events',
  description: 'Tools voor het organiseren van Bingo, Ganzebord, Losse Races en Gauntlet voor je OSRS-community',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl" className={`${cinzel.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
