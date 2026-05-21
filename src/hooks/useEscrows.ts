'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useWriteContract, useAccount } from 'wagmi';
import { parseEther, encodeFunctionData } from 'viem';
import { EscrowProject, Milestone } from '../types';
import {
  ESCROW_MANAGER_ADDRESS,
  ESCROW_MANAGER_ABI,
  MOCK_USD_ADDRESS,
  MOCK_USD_ABI,
  REPUTATION_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ABI,
} from '../lib/constants';

interface SolidityMilestone {
  id: bigint;
  title: string;
  amount: bigint;
  status: number;
  deliveryNotes: string;
  deliveryTime: bigint;
}

export function useEscrows() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  
  const [projects, setProjects] = useState<EscrowProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMinting, setIsMinting] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!publicClient) return;
    setIsLoading(true);
    try {
      const counter = await publicClient.readContract({
        address: ESCROW_MANAGER_ADDRESS,
        abi: ESCROW_MANAGER_ABI,
        functionName: 'escrowCounter',
      });

      const fetchedList: EscrowProject[] = [];
      const totalCount = Number(counter);

      for (let i = 1; i <= totalCount; i++) {
        const escrowData = await publicClient.readContract({
          address: ESCROW_MANAGER_ADDRESS,
          abi: ESCROW_MANAGER_ABI,
          functionName: 'escrows',
          args: [BigInt(i)],
        }) as readonly [bigint, `0x${string}`, `0x${string}`, bigint, string, string];

        const milestonesData = await publicClient.readContract({
          address: ESCROW_MANAGER_ADDRESS,
          abi: ESCROW_MANAGER_ABI,
          functionName: 'getMilestones',
          args: [BigInt(i)],
        });

        const milestones: Milestone[] = (milestonesData as readonly SolidityMilestone[]).map((m) => ({
          id: Number(m.id),
          title: m.title,
          amount: (Number(m.amount) / 10 ** 18).toString(),
          status: ['Pending', 'Funded', 'Delivered', 'Released', 'Cancelled', 'Disputed'][m.status] as Milestone['status'],
          deliveryNotes: m.deliveryNotes,
          deliveryTime: Number(m.deliveryTime),
        }));

        const totalAmount = milestones.reduce((sum, m) => sum + parseFloat(m.amount), 0).toString();

        let overallStatus: EscrowProject['status'] = 'Pending';
        if (milestones.length > 0) {
          if (milestones.every((m) => m.status === 'Released')) {
            overallStatus = 'Released';
          } else if (milestones.some((m) => m.status === 'Disputed')) {
            overallStatus = 'Disputed';
          } else if (milestones.some((m) => m.status === 'Delivered')) {
            overallStatus = 'Delivered';
          } else if (milestones.some((m) => m.status === 'Funded')) {
            overallStatus = 'Funded';
          } else if (milestones.every((m) => m.status === 'Cancelled')) {
            overallStatus = 'Cancelled';
          }
        }

        fetchedList.push({
          id: i.toString(),
          title: escrowData[4],
          description: escrowData[5],
          freelancerAddress: escrowData[2],
          clientAddress: escrowData[1],
          amount: totalAmount,
          deadline: new Date(Number(escrowData[3]) * 1000).toISOString(),
          status: overallStatus,
          milestones,
        });
      }

      setProjects(fetchedList.reverse()); // Show newest first
    } catch (error) {
      console.error('Error fetching on-chain escrows:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects, address]);

  const mintTestMockUSD = async (walletAddress: string, amount: string): Promise<boolean> => {
    setIsMinting(true);
    try {
      const tx = await writeContractAsync({
        address: MOCK_USD_ADDRESS,
        abi: MOCK_USD_ABI,
        functionName: 'mint',
        args: [walletAddress as `0x${string}`, parseEther(amount)],
      });
      return !!tx;
    } catch (error) {
      console.error('Failed minting MockUSD:', error);
      return false;
    } finally {
      setIsMinting(false);
    }
  };

  const checkAllowance = async (owner: string, amount: string): Promise<boolean> => {
    if (!publicClient) return false;
    try {
      const allowance = await publicClient.readContract({
        address: MOCK_USD_ADDRESS,
        abi: MOCK_USD_ABI,
        functionName: 'allowance',
        args: [owner as `0x${string}`, ESCROW_MANAGER_ADDRESS],
      });
      return allowance >= parseEther(amount);
    } catch {
      return false;
    }
  };

  const approveMockUSD = async (amount: string): Promise<string> => {
    return await writeContractAsync({
      address: MOCK_USD_ADDRESS,
      abi: MOCK_USD_ABI,
      functionName: 'approve',
      args: [ESCROW_MANAGER_ADDRESS, parseEther(amount)],
    });
  };

  const getReputation = async (freelancer: string) => {
    if (!publicClient) return { rating: 0, count: 0 };
    try {
      const result = await publicClient.readContract({
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'getReputation',
        args: [freelancer as `0x${string}`],
      });
      return { rating: Number(result[0]) / 10, count: Number(result[1]) };
    } catch {
      return { rating: 0, count: 0 };
    }
  };

  const rateFreelancer = async (freelancer: string, score: number, comment: string) => {
    return await writeContractAsync({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'rateFreelancer',
      args: [freelancer as `0x${string}`, score, comment],
    });
  };

  return {
    projects,
    isLoading,
    isMinting,
    mintTestMockUSD,
    checkAllowance,
    approveMockUSD,
    getReputation,
    rateFreelancer,
    refreshProjects: fetchProjects,
  };
}
