'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { Menu, X } from 'lucide-react';
import { MOCK_USD_ADDRESS, MOCK_USD_ABI } from '../lib/constants';

export function Navbar({ id }: { id?: string }) {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: balance } = useReadContract({
    address: MOCK_USD_ADDRESS,
    abi: MOCK_USD_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const formattedBalance = balance ? (Number(balance) / 10 ** 18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';

  const isLinkActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'History', path: '/history' },
  ];

  return (
    <nav id={id} className="fixed top-0 left-0 right-0 h-16 bg-[#08080c]/90 backdrop-blur-md border-b border-white/5 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="font-bold text-white text-lg tracking-tight hover:opacity-90 transition-opacity focus:outline-none"
          >
            EscrowX <span className="text-sm">🛡️</span>
          </Link>
          <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Base Sepolia Testnet
          </span>
        </div>

        {/* Center - Hidden on Mobile */}
        <div className="hidden md:flex items-center gap-6 h-full">
          {navLinks.map((link) => {
            const isActive = isLinkActive(link.path);
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`relative h-full flex items-center text-sm font-medium transition-colors ${
                  isActive ? 'text-white font-semibold' : 'text-[#6b7280] hover:text-white'
                }`}
              >
                <span>{link.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#7c3aed] rounded-full" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Side */}
        <div className="hidden md:flex items-center gap-4">
          {isConnected ? (
            <div className="bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-xs font-bold px-3 py-1.5 rounded-lg">
              ${formattedBalance} MockUSD
            </div>
          ) : (
            <span className="text-[10px] text-[#6b7280] animate-pulse">
              Connect wallet to start
            </span>
          )}
          <ConnectButton 
            showBalance={false}
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'full',
            }}
          />
        </div>

        {/* Mobile menu trigger */}
        <div className="md:hidden flex items-center gap-3">
          <ConnectButton 
            showBalance={false}
            accountStatus="avatar"
          />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-white hover:text-[#6b7280] transition-colors p-2 focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-[#08080c] border-b border-white/5 py-4 px-6 space-y-3 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => {
              const isActive = isLinkActive(link.path);
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm py-2 block font-medium transition-colors ${
                    isActive ? 'text-white border-l-2 border-[#7c3aed] pl-2' : 'text-[#6b7280] hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            {isConnected ? (
              <div className="bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-xs font-bold px-3 py-1.5 rounded-lg">
                ${formattedBalance} MockUSD
              </div>
            ) : (
              <span className="text-[10px] text-[#6b7280]">Connect wallet to start</span>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
