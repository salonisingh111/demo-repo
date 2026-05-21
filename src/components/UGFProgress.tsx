'use client';

import React from 'react';
import { UGFStepProgress } from '../types';
import { Check, Loader2, X, Circle } from 'lucide-react';

interface UGFProgressProps {
  id: string;
  steps: UGFStepProgress[];
  isExecuting: boolean;
}

export function UGFProgress({ id, steps, isExecuting }: UGFProgressProps) {
  if (!isExecuting) {
    return null;
  }

  const mapStepTitle = (originalStep: string) => {
    if (originalStep.toLowerCase().includes('quote')) return 'Checking Gas Cost';
    if (originalStep.toLowerCase().includes('settle')) return 'Authorizing Payment';
    if (originalStep.toLowerCase().includes('execute')) return 'Submitting to Blockchain';
    if (originalStep.toLowerCase().includes('confirm')) return 'Waiting for Confirmation';
    return originalStep;
  };

  const mapStepDesc = (originalStep: string) => {
    if (originalStep.toLowerCase().includes('quote')) return 'Calculating the MockUSD fee for this action';
    if (originalStep.toLowerCase().includes('settle')) return 'Signing your permission to use MockUSD';
    if (originalStep.toLowerCase().includes('execute')) return 'Sending your transaction to Base Sepolia';
    if (originalStep.toLowerCase().includes('confirm')) return 'Transaction is being mined on-chain';
    return 'Processing relayer protocol step...';
  };

  // Calculate active steps percentage for the progress line
  const completedCount = steps.filter((s) => s.status === 'success').length;
  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <div
      id={id}
      className="w-full bg-[#0c0c10] border border-white/8 rounded-2xl p-6 hover:border-[#7c3aed]/25 hover:bg-[#0e0e14] transition-all duration-200 relative overflow-hidden space-y-6 animate-in fade-in duration-300"
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">Processing Your Transaction</h3>
          <p className="text-sm text-[#6b7280] leading-relaxed">
            This usually takes 10–15 seconds. Your ETH balance stays at zero.
          </p>
        </div>
        <span className="text-[10px] text-[#7c3aed] border border-[#7c3aed]/20 px-2 py-0.5 rounded-full shrink-0 font-semibold uppercase tracking-wider">
          Powered by UGF ⚡
        </span>
      </div>

      {/* Steps List */}
      <div className="space-y-4 pt-2">
        {steps.map((step, idx) => {
          const isIdle = step.status === 'idle';
          const isLoading = step.status === 'loading';
          const isSuccess = step.status === 'success';
          const isError = step.status === 'error';

          let iconBg = 'bg-white/5 border border-white/10 text-[#6b7280]';
          let textColor = 'text-[#6b7280]';

          if (isLoading) {
            iconBg = 'bg-[#7c3aed]/15 border border-[#7c3aed]/30 text-[#7c3aed]';
            textColor = 'text-white';
          } else if (isSuccess) {
            iconBg = 'bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981]';
            textColor = 'text-[#10b981]';
          } else if (isError) {
            iconBg = 'bg-rose-500/15 border border-rose-500/30 text-rose-400';
            textColor = 'text-rose-400';
          }

          return (
            <div key={idx} className="flex items-start gap-4">
              {/* Left Circle Icon (36x36) */}
              <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                {isIdle && <Circle className="h-4 w-4 text-[#6b7280]" />}
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-[#7c3aed]" />}
                {isSuccess && <Check className="h-4 w-4 text-[#10b981]" />}
                {isError && <X className="h-4 w-4 text-rose-400" />}
              </div>

              {/* Right content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <h4 className={`text-sm font-semibold ${textColor}`}>
                    {mapStepTitle(step.step)}
                  </h4>
                  {step.timestamp && (
                    <span className="text-[10px] text-[#6b7280] font-mono shrink-0">
                      {step.timestamp}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6b7280] leading-relaxed mt-0.5">
                  {mapStepDesc(step.step)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 pt-2">
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7c3aed] to-[#10b981] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
