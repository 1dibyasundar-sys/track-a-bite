import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '../components/layout/navbar';
import { MobileBottomNav } from '../components/layout/mobile-bottom-nav';
import { Footer } from '../components/layout/footer';
import { AuthProvider } from '../components/auth/AuthProvider';
import { ThemeProvider } from '../components/theme/ThemeProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://track-a-bite.vercel.app'),
  title: {
    default: 'Track-a-Bite | Regional Indian Food & Nutrition Intelligence',
    template: '%s | Track-a-Bite',
  },
  description:
    'Use your camera to identify local Indian foods, understand estimated nutrition, and discover practical, affordable ways to balance your everyday meals.',
  keywords: [
    'Indian nutrition',
    'food recognition',
    'dal chawal nutrition',
    'millets',
    'ragi',
    'sattu',
    'macro calculator',
    'affordable protein',
    'hostel diet',
    'student meal planning',
    'micronutrients',
    'hydration tracker',
  ],
  authors: [{ name: 'Track-a-Bite Team' }],
  creator: 'Track-a-Bite',
  publisher: 'Track-a-Bite',
  applicationName: 'Track-a-Bite',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://track-a-bite.vercel.app',
    title: 'Track-a-Bite | Regional Indian Food & Nutrition Intelligence',
    description:
      'AI-powered regional Indian food recognition and personalized nutrition assistant for students, hostelites, and conscious eaters.',
    siteName: 'Track-a-Bite',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Track-a-Bite | Regional Indian Food & Nutrition Intelligence',
    description:
      'AI-powered regional Indian food recognition and personalized nutrition assistant.',
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
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('track-a-bite-theme');
      var theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
        root.style.colorScheme = 'light';
      }
      root.setAttribute('data-theme-setting', theme);
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeScript,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <main className="flex-1 flex flex-col pb-16 md:pb-0">{children}</main>
            <Footer />
            <MobileBottomNav />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
