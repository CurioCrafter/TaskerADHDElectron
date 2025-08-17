import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { useEffect } from 'react'
import { wrapFetchWithDebug } from '@/lib/fetch-debug'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'TaskerADHD - ADHD-Friendly Task Management',
  description: 'Voice-to-task capture and ADHD-friendly productivity system. Designed for neurodivergent minds.',
  keywords: ['ADHD', 'productivity', 'task management', 'voice capture', 'neurodivergent'],
  authors: [{ name: 'TaskerADHD Team' }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://taskeradhd.com',
    title: 'TaskerADHD - ADHD-Friendly Task Management',
    description: 'Voice-to-task capture and ADHD-friendly productivity system. Designed for neurodivergent minds.',
    siteName: 'TaskerADHD',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaskerADHD - ADHD-Friendly Task Management',
    description: 'Voice-to-task capture and ADHD-friendly productivity system. Designed for neurodivergent minds.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Dev-only: wrap fetch to log API calls
  if (typeof window !== 'undefined') {
    wrapFetchWithDebug()
  }
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Accessibility meta tags */}
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        {/* Prevent theme flash: set initial theme class before hydration */}
        <script
          dangerouslySetInnerHTML={{ __html: `
            (function(){
              try {
                var stored = localStorage.getItem('taskeradhd-settings');
                var theme = null;
                if (stored) {
                  var parsed = JSON.parse(stored);
                  if (parsed && parsed.state && parsed.state.theme) theme = parsed.state.theme;
                  if (!theme && parsed.theme) theme = parsed.theme;
                }
                if (!theme) {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                var doc = document.documentElement;
                doc.classList.remove('light','dark','low-stim');
                doc.classList.add(theme);
              } catch(e){}
            })();
          `}}
        />
        
        {/* Progressive Web App meta */}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body 
        className={`
          ${inter.className} 
          antialiased 
          bg-gray-50 dark:bg-gray-900 
          text-gray-900 dark:text-gray-100 
          selection:bg-primary-100 
          selection:text-primary-900
          focus-within:outline-none
        `}
        aria-live="polite"
      >
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Skip to main content
          </a>

          <div id="app-root" className="min-h-screen">
            {children}
          </div>

          <Toaster
            position="top-right"
            gutter={8}
            containerClassName="z-50"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#ffffff',
                color: '#374151',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '12px 16px',
                fontSize: '14px',
                maxWidth: '400px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#ffffff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#ffffff',
                },
                duration: 6000,
              },
              loading: {
                iconTheme: {
                  primary: '#3b82f6',
                  secondary: '#ffffff',
                },
              },
            }}
          />

          <div
            id="announcements"
            aria-live="assertive"
            aria-atomic="true"
            className="sr-only"
          />

        </Providers>
      </body>
    </html>
  )
}
