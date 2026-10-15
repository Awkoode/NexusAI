import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { RouteTransitions } from '@/components/RouteTransitions';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'NexusAI — Plataforma de Análise de Dados e Machine Learning',
  description: 'Plataforma web para análise de dados, estatística e machine learning. Gerencie projetos, datasets e experimentos em um só lugar.',
  keywords: ['data analysis', 'machine learning', 'statistics', 'data science', 'ML platform'],
  authors: [{ name: 'NexusAI Team' }],
  creator: 'NexusAI',
  publisher: 'NexusAI',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://nexusai.example.com',
    title: 'NexusAI — Plataforma de Análise de Dados e Machine Learning',
    description: 'Plataforma web para análise de dados, estatística e machine learning.',
    siteName: 'NexusAI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NexusAI',
    description: 'Plataforma web para análise de dados, estatística e machine learning.',
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50">
        <AuthProvider>
          <RouteTransitions />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}