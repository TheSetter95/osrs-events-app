import type { MetadataRoute } from 'next'

// Houdt zoekmachines en bots weg bij de API en de pagina's achter de login.
// Dat scheelt onnodige serverless-aanroepen.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacybeleid', '/voorwaarden'],
        disallow: ['/api/', '/communities/', '/dashboard', '/profiel', '/beheer', '/login'],
      },
    ],
  }
}
