'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { useEscrows } from '@/hooks/useEscrows';
import { useToast } from '@/components/ToastProvider';
import { MOCK_USD_ADDRESS, MOCK_USD_ABI } from '@/lib/constants';
import { Shield, Loader2, ArrowRight } from 'lucide-react';
import { EscrowProject } from '@/types';

const dummyProjects: EscrowProject[] = [
  {
    id: 'demo-1',
    title: 'Landing Page Rebranding & SEO',
    description: 'Complete UI overhaul for a decentralized escrow platform. Tasks include full-responsive mobile layout designs, asset optimization, Tailwind CSS style injection, and performance metrics setup.',
    freelancerAddress: '0xE25514E9db69F49377B6343C1D0694bA1C5DbE6F',
    clientAddress: '0x95c25d8f0802c676d1e43444007f3944',
    amount: '450',
    deadline: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
    status: 'Funded',
    milestones: []
  },
  {
    id: 'demo-2',
    title: 'Smart Contract Audit',
    description: 'Formal verification of milestone contracts, auditing auto-release locks, gas optimization using Assembly Yul, and seeding hardhat deployment scripts.',
    freelancerAddress: '0xE25514E9db69F49377B6343C1D0694bA1C5DbE6F',
    clientAddress: '0x95c25d8f0802c676d1e43444007f3944',
    amount: '800',
    deadline: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    status: 'Delivered',
    milestones: []
  }
];

export default function Dashboard() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { projects, isLoading, mintTestMockUSD, isMinting } = useEscrows();
  const toast = useToast();
  
  // Underline tab filters: 'All' | 'Client' | 'Freelancer'
  const [activeTab, setActiveTab] = useState<'All' | 'Client' | 'Freelancer'>('All');

  // Read live balance to trigger low balance warning
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: MOCK_USD_ADDRESS,
    abi: MOCK_USD_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const rawBalance = balance ? Number(balance) / 10 ** 18 : 0;
  const isBalanceLow = isConnected && rawBalance < 100;

  // Use on-chain projects, fallback to mock demo seeds if no on-chain records exist
  const activeList = projects.length > 0 ? projects : (isConnected ? [] : dummyProjects);

  const totalCount = activeList.length;
  const clientCount = activeList.filter(
    (p) => address && p.clientAddress.toLowerCase() === address.toLowerCase()
  ).length;
  const freelancerCount = activeList.filter(
    (p) => address && p.freelancerAddress.toLowerCase() === address.toLowerCase()
  ).length;

  const filteredProjects = activeList.filter((project) => {
    if (!address) return true; // Show all dummy items if not connected

    const isClient = project.clientAddress.toLowerCase() === address.toLowerCase();
    const isFreelancer = project.freelancerAddress.toLowerCase() === address.toLowerCase();

    if (activeTab === 'Client') return isClient;
    if (activeTab === 'Freelancer') return isFreelancer;
    return isClient || isFreelancer;
  });

  const handleClaimFaucet = async () => {
    if (!address) return;
    toast.info('Requesting Faucet', 'Minting 1,000 MockUSD tokens gaslessly...');
    const success = await mintTestMockUSD(address, '1000');
    if (success) {
      toast.success('Faucet Claimed', 'Successfully received 1,000 MockUSD!');
      refetchBalance();
    } else {
      toast.error('Faucet Failed', 'Failed to request faucet tokens.');
    }
  };

  const getStatusBadge = (status: EscrowProject['status']) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse shrink-0" />
            <span>Awaiting Funding</span>
          </span>
        );
      case 'Funded':
        return (
          <span className="bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] mr-1.5 animate-pulse shrink-0" />
            <span>Work in Progress</span>
          </span>
        );
      case 'Delivered':
      case 'Disputed':
        return (
          <span className="bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#7c3aed] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed] mr-1.5 animate-pulse shrink-0" />
            <span>Review Work</span>
          </span>
        );
      case 'Released':
        return (
          <span className="bg-[#10b981]/15 border border-[#10b981]/25 text-[#10b981] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center shrink-0">
            <span>✓ Complete</span>
          </span>
        );
      case 'Cancelled':
        return (
          <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center shrink-0">
            <span>Cancelled</span>
          </span>
        );
    }
  };

  const handleCardClick = (projectId: string) => {
    if (projectId.startsWith('demo')) {
      router.push('/create');
    } else {
      router.push(`/escrow/${projectId}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 animate-in fade-in duration-200">
      {/* TOP BAR */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-white">My Escrows</h1>
        <Link
          href="/create"
          className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl flex items-center justify-center gap-1 transition-all duration-150 active:scale-98"
        >
          + New Escrow
        </Link>
      </div>

      {/* LOW BALANCE BANNER */}
      {isBalanceLow && (
        <div className="bg-amber-400/8 border border-amber-400/15 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <span className="text-amber-400 text-sm font-medium">
            ⚠️ Your MockUSD balance is low (${rawBalance.toFixed(0)} MockUSD). Get free tokens from the faucet.
          </span>
          <button
            onClick={handleClaimFaucet}
            disabled={isMinting}
            className="text-amber-400 hover:text-white text-xs font-bold underline flex items-center gap-1.5 disabled:opacity-50"
          >
            {isMinting ? <Loader2 className="h-3 w-3 animate-spin text-amber-400" /> : null}
            <span>Claim $1,000 Faucet →</span>
          </button>
        </div>
      )}

      {/* ROLE FILTER TAB SELECTORS */}
      <div className="flex items-center gap-6 border-b border-white/5 pb-0">
        <button
          onClick={() => setActiveTab('All')}
          className={`text-sm font-semibold pb-3 flex items-center gap-1.5 border-b-2 transition-all relative ${
            activeTab === 'All' ? 'text-white border-[#7c3aed]' : 'text-[#6b7280] hover:text-white border-transparent'
          }`}
        >
          <span>All</span>
          <span className="bg-white/8 text-[10px] px-1.5 rounded-full text-[#6b7280] group-hover:text-white">
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('Client')}
          className={`text-sm font-semibold pb-3 flex items-center gap-1.5 border-b-2 transition-all relative ${
            activeTab === 'Client' ? 'text-white border-[#7c3aed]' : 'text-[#6b7280] hover:text-white border-transparent'
          }`}
        >
          <span>I'm the Client</span>
          <span className="bg-white/8 text-[10px] px-1.5 rounded-full text-[#6b7280]">
            {clientCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('Freelancer')}
          className={`text-sm font-semibold pb-3 flex items-center gap-1.5 border-b-2 transition-all relative ${
            activeTab === 'Freelancer' ? 'text-white border-[#7c3aed]' : 'text-[#6b7280] hover:text-white border-transparent'
          }`}
        >
          <span>I'm the Freelancer</span>
          <span className="bg-white/8 text-[10px] px-1.5 rounded-full text-[#6b7280]">
            {freelancerCount}
          </span>
        </button>
      </div>

      {/* GRID LIST OR EMPTY STATE */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
          <div className="h-12 w-12 rounded-full bg-[#7c3aed]/10 flex items-center justify-center text-primary border border-[#7c3aed]/20">
            <Shield className="h-6 w-6 text-[#7c3aed]/40" />
          </div>
          <h3 className="text-base font-semibold text-white mt-4">No Escrows Yet</h3>
          <p className="text-sm text-[#6b7280] mt-1">
            Create your first gasless escrow to get started.
          </p>
          <Link
            href="/create"
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl mt-6 transition-all duration-150 flex items-center justify-center active:scale-98"
          >
            Create Escrow
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const isClient = address ? project.clientAddress.toLowerCase() === address.toLowerCase() : true;
            const daysLeft = Math.ceil(
              (new Date(project.deadline).getTime() - Date.now()) / (1000 * 3600 * 24)
            );
            const isNearDeadline = daysLeft >= 0 && daysLeft < 3;

            return (
              <div
                onClick={() => handleCardClick(project.id)}
                key={project.id}
                className="bg-[#0c0c10] border border-white/8 rounded-2xl p-6 hover:border-[#7c3aed]/25 hover:bg-[#0e0e14] transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-sm font-semibold text-white line-clamp-1">
                      {project.title}
                    </h3>
                    {getStatusBadge(project.status)}
                  </div>
                  <p className="text-xs text-[#6b7280] line-clamp-2 leading-relaxed mt-2">
                    {project.description}
                  </p>
                </div>

                <div className="border-t border-white/5 mt-4 pt-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-base font-black text-white">${Number(project.amount).toLocaleString()} MockUSD</span>
                    <span className="text-[10px] text-[#6b7280] uppercase tracking-wide block">locked</span>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase ${
                        isClient
                          ? 'bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20'
                          : 'bg-white/5 text-white border border-white/10'
                      }`}
                    >
                      {isClient ? 'You are the Client' : 'You are the Freelancer'}
                    </span>

                    {daysLeft >= 0 ? (
                      <span
                        className={`text-[10px] font-semibold ${
                          isNearDeadline ? 'text-amber-400' : 'text-[#6b7280]'
                        }`}
                      >
                        Due in {daysLeft} day{daysLeft === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-400 font-semibold uppercase">Expired</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
