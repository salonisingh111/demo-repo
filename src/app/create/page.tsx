'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { encodeFunctionData, parseEther } from 'viem';
import { useEscrows } from '@/hooks/useEscrows';
import { useUGF } from '@/hooks/useUGF';
import { useToast } from '@/components/ToastProvider';
import { UGFProgress } from '@/components/UGFProgress';
import { MOCK_USD_ADDRESS, MOCK_USD_ABI, ESCROW_MANAGER_ADDRESS, ESCROW_MANAGER_ABI } from '@/lib/constants';
import { Check, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CreateEscrow() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { mintTestMockUSD, isMinting, refreshProjects } = useEscrows();
  const { isExecuting, ugfStepProgress, executeGaslessTransaction } = useUGF();
  const toast = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [freelancer, setFreelancer] = useState('');
  const [amount, setAmount] = useState('');
  const [deadlineDays, setDeadlineDays] = useState('7');
  const [formError, setFormError] = useState('');

  // Fetch balance for warning
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
  const hasInsufficientBalance = isConnected && Number(amount) > rawBalance;

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7c3aed', '#10b981', '#ffffff'],
    });
  };

  const handleClaimFaucet = async () => {
    if (!address) return;
    toast.info('Claiming Faucet', 'Requesting 1,000 MockUSD tokens...');
    const success = await mintTestMockUSD(address, '1000');
    if (success) {
      toast.success('Faucet Successful', 'Successfully minted 1,000 MockUSD! Ready to fund.');
      refetchBalance();
    } else {
      toast.error('Faucet Failed', 'Faucet transaction could not be processed.');
    }
  };

  const validateStep1 = () => {
    setFormError('');
    if (!title.trim()) {
      setFormError('Please enter a project title.');
      return false;
    }
    if (!description.trim()) {
      setFormError('Please enter a description of the work.');
      return false;
    }
    if (!freelancer.startsWith('0x') || freelancer.length !== 42) {
      setFormError('Freelancer address must be a valid 42-character Ethereum address (starting with 0x).');
      return false;
    }
    if (address && freelancer.toLowerCase() === address.toLowerCase()) {
      setFormError('You cannot set yourself as the freelancer for this escrow.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    setFormError('');
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Amount must be a positive number greater than 0.');
      return false;
    }
    if (amt > rawBalance) {
      setFormError('You have insufficient MockUSD. Please mint faucet tokens or reduce the budget.');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    setFormError('');
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    }
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!isConnected || !address) {
      toast.error('Wallet Disconnected', 'Please connect your wallet in the navigation bar to proceed.');
      return;
    }

    try {
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + Number(deadlineDays) * 24 * 60 * 60;
      
      // Multi-milestone array format for upgraded solidity contract: single milestone of total amount
      const milestoneTitles = [title];
      const milestoneAmounts = [parseEther(amount)];

      // 1. Encode execution call for createEscrow(address freelancer, uint256 deadline, string title, string description, string[] milestoneTitles, uint256[] milestoneAmounts)
      const encodedData = encodeFunctionData({
        abi: ESCROW_MANAGER_ABI,
        functionName: 'createEscrow',
        args: [
          freelancer as `0x${string}`,
          BigInt(deadlineTimestamp),
          title,
          description,
          milestoneTitles,
          milestoneAmounts,
        ],
      });

      // 2. Execute gasless transaction via UGF client
      toast.info('Initiating Escrow', 'Launching UGF sponsored gasless escrow tunnel...');
      await executeGaslessTransaction(
        'Create',
        'new-escrow',
        amount,
        ESCROW_MANAGER_ADDRESS,
        encodedData
      );

      // 3. Confirm target creation index
      let nextId = '1';
      if (publicClient) {
        const counter = await publicClient.readContract({
          address: ESCROW_MANAGER_ADDRESS,
          abi: ESCROW_MANAGER_ABI,
          functionName: 'escrowCounter',
        });
        nextId = Number(counter).toString();
      }

      toast.success('Escrow Deployed', 'Your gasless escrow agreement has been deployed successfully!');
      triggerConfetti();
      await refreshProjects();

      setTimeout(() => {
        router.push(`/escrow/${nextId}`);
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UGF transaction failed.';
      setFormError(msg);
      toast.error('Escrow Deployment Failed', 'The sponsored transaction could not be processed on-chain.');
    }
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Replace page content with UGFProgress overlay while executing
  if (isExecuting) {
    return (
      <div className="max-w-md mx-auto py-16 animate-fade-in">
        <UGFProgress id="create-ugf-progress" steps={ugfStepProgress} isExecuting={isExecuting} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-4 space-y-8 animate-in fade-in duration-200">
      {/* STEP INDICATOR */}
      <div className="flex items-center justify-between gap-2 px-4">
        {/* Step 1 */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              currentStep > 1
                ? 'bg-[#10b981] text-white'
                : currentStep === 1
                ? 'bg-[#7c3aed] text-white'
                : 'bg-white/5 border border-white/10 text-[#6b7280]'
            }`}
          >
            {currentStep > 1 ? <Check className="h-4 w-4" /> : 1}
          </div>
          <span
            className={`text-[9px] font-bold uppercase tracking-wider ${
              currentStep >= 1 ? 'text-white' : 'text-[#6b7280]'
            }`}
          >
            Project Details
          </span>
        </div>

        {/* Line 1 */}
        <div
          className={`flex-1 h-px transition-all duration-300 ${
            currentStep > 1 ? 'bg-[#10b981]' : 'bg-white/8'
          }`}
        />

        {/* Step 2 */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              currentStep > 2
                ? 'bg-[#10b981] text-white'
                : currentStep === 2
                ? 'bg-[#7c3aed] text-white'
                : 'bg-white/5 border border-white/10 text-[#6b7280]'
            }`}
          >
            {currentStep > 2 ? <Check className="h-4 w-4" /> : 2}
          </div>
          <span
            className={`text-[9px] font-bold uppercase tracking-wider ${
              currentStep >= 2 ? 'text-white' : 'text-[#6b7280]'
            }`}
          >
            Budget
          </span>
        </div>

        {/* Line 2 */}
        <div
          className={`flex-1 h-px transition-all duration-300 ${
            currentStep > 2 ? 'bg-[#10b981]' : 'bg-white/8'
          }`}
        />

        {/* Step 3 */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              currentStep === 3
                ? 'bg-[#7c3aed] text-white'
                : 'bg-white/5 border border-white/10 text-[#6b7280]'
            }`}
          >
            3
          </div>
          <span
            className={`text-[9px] font-bold uppercase tracking-wider ${
              currentStep === 3 ? 'text-white' : 'text-[#6b7280]'
            }`}
          >
            Confirm
          </span>
        </div>
      </div>

      {formError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium animate-fade-in">
          {formError}
        </div>
      )}

      {/* STEP 1: Project Details */}
      {currentStep === 1 && (
        <div className="bg-[#0c0c10] border border-white/8 rounded-2xl p-6 space-y-5 animate-in fade-in duration-200">
          <div className="space-y-1.5">
            <label htmlFor="project-title" className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">
              Project Title
            </label>
            <input
              id="project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mobile App UI Design"
              className="w-full h-11 px-4 bg-[#060608] border border-white/8 rounded-xl text-white text-sm placeholder-[#6b7280]/60 focus:outline-none focus:border-[#7c3aed]/50 focus:ring-1 focus:ring-[#7c3aed]/30 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="project-desc" className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">
              Project Description
            </label>
            <textarea
              id="project-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work, deliverables, and any important details..."
              className="w-full p-4 bg-[#060608] border border-white/8 rounded-xl text-white text-sm placeholder-[#6b7280]/60 focus:outline-none focus:border-[#7c3aed]/50 focus:ring-1 focus:ring-[#7c3aed]/30 transition-all resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="freelancer-wallet" className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">
              Freelancer's Wallet Address
            </label>
            <input
              id="freelancer-wallet"
              type="text"
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              placeholder="0x..."
              className="w-full h-11 px-4 bg-[#060608] border border-white/8 rounded-xl text-white text-sm placeholder-[#6b7280]/60 font-mono focus:outline-none focus:border-[#7c3aed]/50 focus:ring-1 focus:ring-[#7c3aed]/30 transition-all"
            />
            <p className="text-xs text-[#6b7280] leading-relaxed mt-1.5">
              💡 Ask your freelancer for their wallet address. It always starts with 0x and is 42 characters long.
            </p>
          </div>

          <button
            onClick={handleNextStep}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all duration-150 w-full flex items-center justify-center active:scale-98"
          >
            Continue →
          </button>
        </div>
      )}

      {/* STEP 2: Budget & Deadline */}
      {currentStep === 2 && (
        <div className="bg-[#0c0c10] border border-white/8 rounded-2xl p-6 space-y-5 animate-in fade-in duration-200">
          <div className="space-y-1.5">
            <label htmlFor="budget-amount" className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">
              How much will you lock?
            </label>
            <input
              id="budget-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500"
              className="w-full h-11 px-4 bg-[#060608] border border-white/8 rounded-xl text-white text-sm placeholder-[#6b7280]/60 focus:outline-none focus:border-[#7c3aed]/50 focus:ring-1 focus:ring-[#7c3aed]/30 transition-all"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-[#6b7280]">
                Your balance: ${rawBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} MockUSD
              </span>
              {hasInsufficientBalance && (
                <button
                  type="button"
                  onClick={handleClaimFaucet}
                  disabled={isMinting}
                  className="text-rose-400 text-xs font-bold hover:underline flex items-center gap-1 focus:outline-none"
                >
                  {isMinting ? <Loader2 className="h-3 w-3 animate-spin" /> : '⚠️'}
                  <span>Not enough MockUSD. Get more here →</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="deadline-select" className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">
              Delivery Deadline
            </label>
            <select
              id="deadline-select"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              className="w-full h-11 px-4 bg-[#060608] border border-white/8 rounded-xl text-white text-sm focus:outline-none focus:border-[#7c3aed]/50 focus:ring-1 focus:ring-[#7c3aed]/30 transition-all cursor-pointer"
            >
              <option value="3">3 Days (Fast Review)</option>
              <option value="7">7 Days (Standard Week)</option>
              <option value="14">14 Days (Two Weeks)</option>
              <option value="30">30 Days (One Month)</option>
            </select>
          </div>

          <div className="bg-[#060608] border border-white/8 rounded-xl p-4 mt-2">
            <p className="text-xs text-[#6b7280] leading-relaxed">
              📋 You will lock <span className="text-white font-semibold">{amount || '0'} MockUSD</span> until you approve the delivered work. If the freelancer misses the deadline, you can cancel and get a refund.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={handlePrevStep}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all duration-150 flex-1 flex items-center justify-center"
            >
              ← Back
            </button>
            <button
              onClick={handleNextStep}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all duration-150 flex-1 flex items-center justify-center active:scale-98"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Confirm */}
      {currentStep === 3 && (
        <div className="bg-[#0c0c10] border border-white/8 rounded-2xl p-6 space-y-5 animate-in fade-in duration-200">
          <div className="divide-y divide-white/5">
            <div className="py-3 flex justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">Project</span>
              <span className="text-sm font-semibold text-white text-right truncate max-w-[200px]">{title}</span>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">Freelancer</span>
              <span className="text-sm font-mono text-white text-right">{truncateAddress(freelancer)}</span>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">Amount</span>
              <span className="text-sm font-bold text-[#10b981]">${Number(amount).toLocaleString()} MockUSD</span>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">Deadline</span>
              <span className="text-sm font-semibold text-white text-right">{deadlineDays} days from now</span>
            </div>
          </div>

          <div className="bg-[#7c3aed]/8 border border-[#7c3aed]/20 rounded-xl p-4 space-y-1">
            <h4 className="text-sm font-semibold text-[#7c3aed]">
              ⚡ Gas fees are handled automatically
            </h4>
            <p className="text-xs text-[#6b7280] leading-relaxed">
              You need 0 ETH. The Universal Gas Framework covers all network fees in MockUSD on your behalf.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={handlePrevStep}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all duration-150 shrink-0"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all duration-150 flex-1 flex items-center justify-center active:scale-98"
            >
              Create Escrow Gaslessly
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
