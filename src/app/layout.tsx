import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/Navbar';
import { OnboardingModal } from '@/components/OnboardingModal';
import { ToastProvider } from '@/components/ToastProvider';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'EscrowX | Gasless Web3 Freelance Escrows',
  description: 'Fund freelance escrows and release payments entirely gaslessly without needing ETH. Secured by Universal Gas Framework on Base Sepolia.',
  keywords: 'Web3, Freelance, Escrow, Gasless, UGF, Universal Gas Framework, Base Sepolia, Smart Contract',
  authors: [{ name: 'EscrowX Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#08080c] text-white font-sans selection:bg-[#7c3aed] selection:text-white">
        <Providers>
          <ToastProvider>
            <Navbar id="main-nav-header" />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
              {children}
            </main>
            <footer className="w-full border-t border-white/5 py-6 text-center text-sm text-[#6b7280]">
              <div className="max-w-7xl mx-auto px-4">
                <p>© {new Date().getFullYear()} EscrowX. Powered by Tychi Labs Universal Gas Framework (UGF).</p>
              </div>
            </footer>
            <OnboardingModal id="global-onboarding-modal" />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
