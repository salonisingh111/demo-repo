'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { UGFTransaction } from '@/types';

export default function HistoryPage() {
  const [txs, setTxs] = useState<UGFTransaction[]>([]);

  useEffect(() => {
    const fetchTxs = async () => {
      const data = await db.getTransactions();
      setTxs(data);
    };
    fetchTxs();
  }, []);

  const getRelativeTime = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffDay > 0) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
    if (diffHr > 0) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    if (diffMin > 0) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    return 'Just now';
  };

  const getActionChip = (type: string) => {
    switch (type) {
      case 'Fund':
        return (
          <span className="bg-[#10b981]/10 text-[#10b981] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Fund
          </span>
        );
      case 'Create':
        return (
          <span className="bg-[#7c3aed]/10 text-[#7c3aed] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Create
          </span>
        );
      case 'Release':
        return (
          <span className="bg-[#10b981]/15 text-[#10b981] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Release
          </span>
        );
      case 'Cancel':
        return (
          <span className="bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Cancel
          </span>
        );
      default:
        return (
          <span className="bg-white/5 text-white border border-white/10 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            {type}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return (
          <span className="bg-[#10b981]/15 border border-[#10b981]/25 text-[#10b981] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
            ✓ Confirmed
          </span>
        );
      case 'Failed':
        return (
          <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
            Failed
          </span>
        );
      default:
        return (
          <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center w-max">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
            <span>Processing</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 animate-in fade-in duration-200">
      {/* Title block */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-white">Transaction History</h1>
        <p className="text-sm text-[#6b7280]">Every gasless action taken on EscrowX</p>
      </div>

      {txs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
          <p className="text-sm font-semibold text-white">No transactions yet</p>
          <p className="text-xs text-[#6b7280] mt-1">
            Create or fund an escrow to see your history here.
          </p>
        </div>
      ) : (
        /* TABLE */
        <div className="w-full bg-[#0c0c10] border border-white/8 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#060608] border-b border-white/5">
                  <th className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] px-6 py-4">
                    Action
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] px-6 py-4">
                    Project
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] px-6 py-4">
                    Amount
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] px-6 py-4">
                    Date
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] px-6 py-4">
                    Status
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] px-6 py-4">
                    Explorer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {txs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4 shrink-0">{getActionChip(tx.type)}</td>
                    <td className="px-6 py-4 text-sm text-white font-medium max-w-[180px] truncate">
                      {tx.projectId === 'new-escrow' ? 'New Escrow Agreement' : `Escrow #${tx.projectId}`}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-white">
                      ${Number(tx.amount).toLocaleString()} MockUSD
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6b7280] whitespace-nowrap">
                      {getRelativeTime(tx.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(tx.status)}</td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {tx.txHash ? (
                        <a
                          href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#7c3aed] text-xs hover:underline font-semibold"
                        >
                          View ↗
                        </a>
                      ) : (
                        <span className="text-[#6b7280] text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
