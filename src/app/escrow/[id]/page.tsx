'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, usePublicClient } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { useEscrows } from '@/hooks/useEscrows';
import { useUGF } from '@/hooks/useUGF';
import { useToast } from '@/components/ToastProvider';
import { UGFProgress } from '@/components/UGFProgress';
import { ESCROW_MANAGER_ADDRESS, ESCROW_MANAGER_ABI } from '@/lib/constants';
import { Check, Copy, ArrowLeft, Loader2, Star, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function EscrowDetails() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { projects, checkAllowance, approveMockUSD, refreshProjects, isLoading, rateFreelancer } = useEscrows();
  const { isExecuting, ugfStepProgress, executeGaslessTransaction } = useUGF();
  const toast = useToast();

  // Submissions and rating states
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Funding allowance states
  const [isAllowanceGranted, setIsAllowanceGranted] = useState(false);
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const project = projects.find((p) => p.id === id);
  const firstMilestone = project?.milestones[0];

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7c3aed', '#10b981', '#ffffff'],
    });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address Copied', `${label} wallet address copied to clipboard.`);
  };

  // Verify ERC-20 MockUSD spending allowance
  const verifyAllowance = useCallback(async () => {
    if (!address || !firstMilestone) return;
    setIsCheckingAllowance(true);
    const allowed = await checkAllowance(address, firstMilestone.amount);
    setIsAllowanceGranted(allowed);
    setIsCheckingAllowance(false);
  }, [address, firstMilestone, checkAllowance]);

  useEffect(() => {
    if (project && address && firstMilestone?.status === 'Pending') {
      verifyAllowance();
    }
  }, [project, address, firstMilestone, verifyAllowance]);

  const handleApprove = async () => {
    if (!firstMilestone) return;
    setIsApproving(true);
    toast.info('Approving MockUSD', 'Authorizing smart contract spending limits...');
    try {
      const tx = await approveMockUSD(firstMilestone.amount);
      if (tx) {
        setIsAllowanceGranted(true);
        toast.success('MockUSD Approved', 'You can now fund the escrow agreement.');
        triggerConfetti();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Permission denied.';
      toast.error('Approval Failed', msg);
    } finally {
      setIsApproving(false);
    }
  };

  const handleFund = async () => {
    if (!project || !firstMilestone) return;
    try {
      const encodedData = encodeFunctionData({
        abi: ESCROW_MANAGER_ABI,
        functionName: 'fundMilestone',
        args: [BigInt(project.id), BigInt(firstMilestone.id)],
      });

      toast.info('Funding Escrow', 'Locking MockUSD inside the smart contract...');
      await executeGaslessTransaction(
        'Fund',
        project.id,
        firstMilestone.amount,
        ESCROW_MANAGER_ADDRESS,
        encodedData
      );

      toast.success('Escrow Funded', 'Agreement is now funded gaslessly and active!');
      triggerConfetti();
      await refreshProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Couldn\'t lock MockUSD.';
      toast.error('Funding Failed', msg);
    }
  };

  const handleDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !firstMilestone || !deliveryNotes.trim()) return;

    try {
      const encodedData = encodeFunctionData({
        abi: ESCROW_MANAGER_ABI,
        functionName: 'markMilestoneDelivered',
        args: [BigInt(project.id), BigInt(firstMilestone.id), deliveryNotes],
      });

      toast.info('Submitting Work', 'Broadcasting milestone proof on-chain...');
      await executeGaslessTransaction(
        'Deliver',
        project.id,
        firstMilestone.amount,
        ESCROW_MANAGER_ADDRESS,
        encodedData
      );

      toast.success('Work Submitted', 'Your work delivery link has been submitted!');
      setShowDeliveryForm(false);
      setDeliveryNotes('');
      triggerConfetti();
      await refreshProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Work submission failed.';
      toast.error('Submission Failed', msg);
    }
  };

  const handleRelease = async () => {
    if (!project || !firstMilestone) return;
    try {
      const encodedData = encodeFunctionData({
        abi: ESCROW_MANAGER_ABI,
        functionName: 'releaseMilestone',
        args: [BigInt(project.id), BigInt(firstMilestone.id)],
      });

      toast.info('Releasing Funds', 'Sponsoring block verification to release MockUSD...');
      await executeGaslessTransaction(
        'Release',
        project.id,
        firstMilestone.amount,
        ESCROW_MANAGER_ADDRESS,
        encodedData
      );

      toast.success('Funds Released', 'Escrow released! stablecoin transferred directly to freelancer.');
      triggerConfetti();
      await refreshProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment release failed.';
      toast.error('Release Failed', msg);
    }
  };

  const handleCancel = async () => {
    if (!project || !firstMilestone) return;
    try {
      const encodedData = encodeFunctionData({
        abi: ESCROW_MANAGER_ABI,
        functionName: 'cancelMilestone',
        args: [BigInt(project.id), BigInt(firstMilestone.id)],
      });

      toast.info('Cancelling Agreement', 'Refunding client MockUSD stablecoin...');
      await executeGaslessTransaction(
        'Cancel',
        project.id,
        firstMilestone.amount,
        ESCROW_MANAGER_ADDRESS,
        encodedData
      );

      toast.success('Escrow Cancelled', 'Escrow agreement cancelled. Funds fully refunded.');
      triggerConfetti();
      await refreshProjects();
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancellation could not be completed.';
      toast.error('Cancellation Failed', msg);
    }
  };

  const handleDispute = async () => {
    if (!project || !firstMilestone) return;
    try {
      const encodedData = encodeFunctionData({
        abi: ESCROW_MANAGER_ABI,
        functionName: 'disputeMilestone',
        args: [BigInt(project.id), BigInt(firstMilestone.id)],
      });

      toast.info('Raising Dispute', 'Initiating decentralized arbitration logs...');
      await executeGaslessTransaction(
        'Dispute',
        project.id,
        firstMilestone.amount,
        ESCROW_MANAGER_ADDRESS,
        encodedData
      );

      toast.success('Dispute Logged', 'A dispute has been officially logged for resolution.');
      triggerConfetti();
      await refreshProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Dispute could not be triggered.';
      toast.error('Dispute Failed', msg);
    }
  };

  const handleRatingSubmit = async () => {
    if (!project) return;
    setIsSubmittingRating(true);
    try {
      await rateFreelancer(project.freelancerAddress, ratingScore, ratingComment || 'Excellent cooperation!');
      setIsRatingSubmitted(true);
      toast.success('Review Submitted', 'Freelancer star rating published successfully!');
      triggerConfetti();
    } catch (err) {
      console.error(err);
      toast.error('Review Failed', 'Failed to publish star rating on-chain.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
        <p className="text-sm text-[#6b7280]">Loading escrow transaction logs...</p>
      </div>
    );
  }

  if (!project || !firstMilestone) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <h3 className="text-white font-bold text-lg">Escrow Agreement Not Found</h3>
        <p className="text-sm text-[#6b7280]">The requested project details could not be loaded.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm h-11 px-6 rounded-xl"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isClient = address?.toLowerCase() === project.clientAddress.toLowerCase();
  const isFreelancer = address?.toLowerCase() === project.freelancerAddress.toLowerCase();

  // Status mapping
  const status = firstMilestone.status;
  const isPending = status === 'Pending';
  const isFunded = status === 'Funded';
  const isDelivered = status === 'Delivered' || status === 'Disputed';
  const isReleased = status === 'Released';

  const daysLeft = Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 3600 * 24));

  // Render variables for vertical timeline
  const steps = [
    { label: 'Created', done: true, time: 'Deployment complete' },
    { label: 'Funded', done: isFunded || isDelivered || isReleased, current: isPending, num: 2 },
    { label: 'Work Delivered', done: isDelivered || isReleased, current: isFunded, num: 3 },
    { label: 'Payment Released', done: isReleased, current: isDelivered, num: 4 },
  ];

  const getStatusBadge = () => {
    switch (status) {
      case 'Pending':
        return (
          <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
            <span>Awaiting Funding</span>
          </span>
        );
      case 'Funded':
        return (
          <span className="bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] mr-1.5 animate-pulse" />
            <span>Work in Progress</span>
          </span>
        );
      case 'Delivered':
      case 'Disputed':
        return (
          <span className="bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#7c3aed] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed] mr-1.5 animate-pulse" />
            <span>Review Work</span>
          </span>
        );
      case 'Released':
        return (
          <span className="bg-[#10b981]/15 border border-[#10b981]/25 text-[#10b981] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
            ✓ Complete
          </span>
        );
      case 'Cancelled':
        return (
          <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
            Cancelled
          </span>
        );
    }
  };

  const renderActionButtons = () => {
    if (!isConnected) {
      return (
        <button
          disabled
          className="bg-white/5 border border-white/10 text-[#6b7280] font-semibold text-sm h-11 px-6 rounded-xl w-full"
        >
          Connect Wallet to Continue
        </button>
      );
    }

    if (isClient && isPending) {
      return (
        <div className="space-y-3 w-full">
          {!isAllowanceGranted ? (
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all w-full flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>Approve MockUSD Permission</span>
            </button>
          ) : (
            <button
              onClick={handleFund}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all w-full flex items-center justify-center active:scale-98"
            >
              Fund Escrow — Lock ${firstMilestone.amount} MockUSD
            </button>
          )}

          <button
            onClick={handleCancel}
            className="text-[#6b7280] hover:text-white text-sm h-9 px-4 rounded-lg transition-colors w-full text-center"
          >
            Cancel Escrow
          </button>
        </div>
      );
    }

    if (isFreelancer && isFunded) {
      return (
        <div className="w-full">
          {!showDeliveryForm ? (
            <button
              onClick={() => setShowDeliveryForm(true)}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all w-full flex items-center justify-center active:scale-98"
            >
              Submit Delivery
            </button>
          ) : null}
        </div>
      );
    }

    if (isClient && isDelivered) {
      return (
        <div className="space-y-3 w-full">
          <button
            onClick={handleRelease}
            className="bg-[#10b981] hover:bg-[#0d9488] text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all w-full flex items-center justify-center active:scale-98"
          >
            Release Payment to Freelancer
          </button>

          <button
            onClick={handleDispute}
            className="text-[#6b7280] hover:text-white text-sm h-9 px-4 rounded-lg transition-colors w-full text-center"
          >
            Raise a Dispute
          </button>
        </div>
      );
    }

    return null;
  };

  if (isExecuting) {
    return (
      <div className="max-w-md mx-auto py-16 animate-fade-in">
        <UGFProgress id="detail-ugf-progress" steps={ugfStepProgress} isExecuting={isExecuting} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4 animate-in fade-in duration-200">
      {/* Back Header */}
      <button
        onClick={() => router.push('/dashboard')}
        className="text-[#6b7280] hover:text-white text-sm h-9 px-4 rounded-lg transition-colors flex items-center gap-1.5 focus:outline-none"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Dashboard</span>
      </button>

      {/* Hero row */}
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">{project.title}</h1>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <span className="bg-white/5 text-white border border-white/10 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase">
            {isClient ? 'Client Role' : 'Freelancer Role'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* TIMELINE */}
        <div className="md:col-span-1 space-y-6 relative pl-6 pr-2 py-2">
          {/* Connector Line */}
          <div className="absolute left-[37px] top-[24px] bottom-[24px] w-px bg-white/8" />
          <div
            className="absolute left-[37px] top-[24px] w-px bg-[#10b981] transition-all duration-300"
            style={{
              height: isReleased ? 'calc(100% - 48px)' : isDelivered ? '66%' : isFunded ? '33%' : '0%',
            }}
          />

          {steps.map((step, idx) => (
            <div key={idx} className="relative flex items-start gap-4 py-2">
              {/* Dot circle */}
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                  step.done
                    ? 'bg-[#10b981] text-white'
                    : step.current
                    ? 'bg-[#7c3aed] ring-2 ring-[#7c3aed]/30 animate-pulse-slow text-white'
                    : 'bg-white/5 border border-white/10 text-[#6b7280]'
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : step.num || 1}
              </div>

              {/* Text info */}
              <div className="space-y-0.5">
                <h4
                  className={`text-sm font-semibold ${
                    step.done ? 'text-[#10b981]' : step.current ? 'text-white' : 'text-[#6b7280]'
                  }`}
                >
                  {step.label}
                </h4>
                {step.done && <p className="text-[10px] text-[#6b7280] font-mono">{step.time}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* DETAILS GRID & DETAILS */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client address */}
            <div className="bg-[#0c0c10] border border-white/8 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#6b7280] font-bold">Client Address</span>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-xs font-mono font-semibold text-white truncate max-w-[150px]">
                  {project.clientAddress}
                </span>
                <button
                  onClick={() => handleCopy(project.clientAddress, 'Client')}
                  className="text-[#6b7280] hover:text-white p-1 rounded transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Freelancer address */}
            <div className="bg-[#0c0c10] border border-white/8 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#6b7280] font-bold">Freelancer Address</span>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-xs font-mono font-semibold text-white truncate max-w-[150px]">
                  {project.freelancerAddress}
                </span>
                <button
                  onClick={() => handleCopy(project.freelancerAddress, 'Freelancer')}
                  className="text-[#6b7280] hover:text-white p-1 rounded transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Amount locked */}
            <div className="bg-[#0c0c10] border border-white/8 rounded-xl p-4">
              <span className="text-[10px] uppercase tracking-wider text-[#6b7280] font-bold">Amount Locked</span>
              <p className="text-sm font-semibold text-[#10b981] mt-1">${firstMilestone.amount} MockUSD</p>
            </div>

            {/* Deadline */}
            <div className="bg-[#0c0c10] border border-white/8 rounded-xl p-4">
              <span className="text-[10px] uppercase tracking-wider text-[#6b7280] font-bold">Deadline</span>
              <p className="text-sm font-semibold text-white mt-1">
                {daysLeft >= 0 ? `${daysLeft} days remaining` : 'Expired'}
              </p>
            </div>
          </div>

          {/* Description summary */}
          <div className="bg-[#0c0c10] border border-white/8 rounded-xl p-5 space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-[#6b7280] font-bold">Project Details</span>
            <p className="text-xs text-[#6b7280] leading-relaxed">{project.description}</p>
          </div>

          {/* Delivery notes card */}
          {(isDelivered || isReleased) && firstMilestone.deliveryNotes ? (
            <div className="bg-[#060608] border border-white/8 rounded-xl p-5">
              <span className="text-xs font-bold uppercase text-[#6b7280]">📦 Submitted Work</span>
              <p className="text-sm text-white mt-2 leading-relaxed whitespace-pre-wrap">
                {firstMilestone.deliveryNotes}
              </p>
            </div>
          ) : null}

          {/* Inline delivery submission form for freelancer */}
          {showDeliveryForm && (
            <form
              onSubmit={handleDeliver}
              className="bg-[#060608] border border-[#7c3aed]/20 rounded-xl p-5 space-y-4 animate-fade-in"
            >
              <div className="space-y-1.5">
                <label htmlFor="notes-textarea" className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  Add your GitHub, Figma, or any deliverable link
                </label>
                <textarea
                  id="notes-textarea"
                  rows={4}
                  required
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="e.g. Completed designs: https://figma.com/file/123..."
                  className="w-full p-4 bg-[#08080c] border border-white/8 rounded-xl text-white text-sm placeholder-[#6b7280]/60 focus:outline-none focus:border-[#7c3aed]/50 focus:ring-1 focus:ring-[#7c3aed]/30 transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all duration-150 active:scale-98 flex items-center justify-center"
                >
                  Submit Delivery Gaslessly
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeliveryForm(false)}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm h-11 px-6 rounded-xl transition-all duration-150"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* On-chain Freelancer Review (Only when released, Client, and review not completed) */}
          {isReleased && isClient && !isRatingSubmitted && (
            <div className="bg-[#0c0c10] border border-white/8 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Rate Freelancer on Base Sepolia</h3>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingScore(star)}
                    className="p-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/40 rounded"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= ratingScore ? 'fill-[#7c3aed] text-[#7c3aed]' : 'text-[#6b7280]/40'
                      } transition-colors`}
                    />
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Share your experience (e.g. Excellent delivery and communication)"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                className="w-full h-11 px-4 bg-[#060608] border border-white/8 rounded-xl text-white text-sm placeholder-[#6b7280]/60 focus:outline-none focus:border-[#7c3aed]/50 transition-all"
              />
              <button
                onClick={handleRatingSubmit}
                disabled={isSubmittingRating}
                className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm h-11 px-6 rounded-xl w-full flex items-center justify-center disabled:opacity-50"
              >
                {isSubmittingRating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Rating'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ACTION SECTION BAR */}
      <div className="border-t border-white/5 pt-6 space-y-4">
        {/* Gas reminder info banner */}
        <div className="bg-[#7c3aed]/8 border border-[#7c3aed]/20 text-[#7c3aed] text-xs font-medium px-4 py-2 rounded-lg inline-flex items-center gap-2">
          <span>⚡</span>
          <span>This action is gasless — paid in MockUSD, not ETH.</span>
        </div>

        {/* Primary State Action Box */}
        <div className="w-full">{renderActionButtons()}</div>
      </div>
    </div>
  );
}
