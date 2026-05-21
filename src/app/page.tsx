'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useEscrows } from '@/hooks/useEscrows';
import { useToast } from '@/components/ToastProvider';
import { ChevronDown, ArrowRight, Loader2 } from 'lucide-react';

export default function LandingPage() {
  const { isConnected, address } = useAccount();
  const { mintTestMockUSD, isMinting } = useEscrows();
  const toast = useToast();
  
  // Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleFaucetMint = async () => {
    if (!isConnected || !address) {
      toast.error('Connect Wallet', 'Please connect your wallet in the navigation bar to request free MockUSD.');
      return;
    }

    toast.info('Requesting Faucet', 'Initiating faucet transaction to mint 1,000 MockUSD...');
    const success = await mintTestMockUSD(address, '1000');
    if (success) {
      toast.success('Faucet Claimed', 'Successfully received 1,000 MockUSD for testing! Sponsored entirely by UGF.');
    } else {
      toast.error('Faucet Failed', 'Faucet claim transaction could not be processed. Please try again.');
    }
  };

  const faqItems = [
    {
      q: 'Do I need ETH to use EscrowX?',
      a: 'No. All gas fees are paid automatically in MockUSD through the Universal Gas Framework. Your wallet needs zero ETH.',
    },
    {
      q: 'Is my MockUSD safe inside the escrow?',
      a: 'Yes. Funds are locked in a smart contract on Base Sepolia. Only you as the client can release or cancel the payment.',
    },
    {
      q: 'What is Base Sepolia?',
      a: 'It\'s a test network for Ethereum. MockUSD here has no real monetary value — it\'s purely for testing this dApp.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-20 space-y-16 animate-in fade-in duration-200">
      {/* SECTION A: HERO */}
      <section className="text-center space-y-6 flex flex-col items-center">
        {/* Pill */}
        <div className="bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#7c3aed] text-xs font-bold px-3 py-1 rounded-full animate-pulse-slow">
          ⚡ Powered by Universal Gas Framework
        </div>

        {/* H1 */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight max-w-2xl mx-auto leading-tight">
          Freelance Escrow Without the Gas Headache
        </h1>

        {/* Subtitle */}
        <p className="text-sm text-[#6b7280] max-w-lg mx-auto leading-relaxed">
          Lock budgets, deliver work, release payments — all in MockUSD. You never need ETH.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-3 pt-4">
          <Link
            href="/dashboard"
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-98"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <button
            onClick={handleFaucetMint}
            disabled={isMinting}
            className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all duration-150 flex items-center gap-2 disabled:opacity-50 active:scale-98"
          >
            {isMinting ? <Loader2 className="h-4 w-4 animate-spin text-[#7c3aed]" /> : null}
            <span>Get Free MockUSD</span>
          </button>
        </div>
      </section>

      {/* SECTION B: HOW IT WORKS */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-white">How EscrowX Works</h2>
          <p className="text-sm text-[#6b7280]">Three steps. No ETH required at any point.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Card 1 */}
          <div className="w-full bg-[#0c0c10] border border-white/8 rounded-2xl p-6 hover:border-[#7c3aed]/25 hover:bg-[#0e0e14] transition-all duration-200 flex flex-col justify-between h-52">
            <div className="space-y-3">
              <div className="h-12 w-12 bg-[#7c3aed]/10 rounded-xl flex items-center justify-center text-xl shrink-0">
                🔒
              </div>
              <h3 className="font-semibold text-white text-sm">Client Locks Budget</h3>
              <p className="text-xs text-[#6b7280] leading-relaxed">
                MockUSD is held in a smart contract. The freelancer can't touch it until you approve.
              </p>
            </div>
            <div className="text-[#10b981] text-[10px] font-bold uppercase tracking-wider mt-4">
              No ETH needed
            </div>
          </div>

          {/* Arrow 1 */}
          <div className="hidden md:block text-[#6b7280] text-xl font-bold px-2 shrink-0 select-none">
            →
          </div>

          {/* Card 2 */}
          <div className="w-full bg-[#0c0c10] border border-white/8 rounded-2xl p-6 hover:border-[#7c3aed]/25 hover:bg-[#0e0e14] transition-all duration-200 flex flex-col justify-between h-52">
            <div className="space-y-3">
              <div className="h-12 w-12 bg-[#7c3aed]/10 rounded-xl flex items-center justify-center text-xl shrink-0">
                📦
              </div>
              <h3 className="font-semibold text-white text-sm">Freelancer Delivers Work</h3>
              <p className="text-xs text-[#6b7280] leading-relaxed">
                The freelancer submits their work and links on-chain. You get notified to review.
              </p>
            </div>
            <div className="text-primary text-[10px] font-bold uppercase tracking-wider mt-4">
              Fully on-chain
            </div>
          </div>

          {/* Arrow 2 */}
          <div className="hidden md:block text-[#6b7280] text-xl font-bold px-2 shrink-0 select-none">
            →
          </div>

          {/* Card 3 */}
          <div className="w-full bg-[#0c0c10] border border-white/8 rounded-2xl p-6 hover:border-[#7c3aed]/25 hover:bg-[#0e0e14] transition-all duration-200 flex flex-col justify-between h-52">
            <div className="space-y-3">
              <div className="h-12 w-12 bg-[#7c3aed]/10 rounded-xl flex items-center justify-center text-xl shrink-0">
                ✅
              </div>
              <h3 className="font-semibold text-white text-sm">Client Releases Payment</h3>
              <p className="text-xs text-[#6b7280] leading-relaxed">
                One click releases the locked MockUSD directly to the freelancer's wallet.
              </p>
            </div>
            <div className="text-[#10b981] text-[10px] font-bold uppercase tracking-wider mt-4">
              Instant settlement
            </div>
          </div>
        </div>
      </section>

      {/* SECTION C: FAQ */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">Common Questions</h2>

        <div className="divide-y divide-white/5">
          {faqItems.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={index} className="py-4">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between text-left text-sm font-semibold text-white cursor-pointer focus:outline-none"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#6b7280] transition-transform duration-200 ${
                      isOpen ? 'transform rotate-180 text-white' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="text-sm text-[#6b7280] leading-relaxed mt-3 animate-in fade-in duration-150">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
