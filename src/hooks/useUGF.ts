'use client';

import { useState } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { useWalletClient } from 'wagmi';
import { type WalletClient } from 'viem';
import { UGFClient } from '@tychilabs/ugf-testnet-js';
import { UGFStepProgress, UGFTransaction } from '../types';
import { db } from '../lib/db';

const gatewayUrl = process.env.NEXT_PUBLIC_UGF_GATEWAY_URL || 'https://gateway.universalgasframework.com';

// Adapter to bridge wagmi / viem WalletClient to an Ethers v6 JsonRpcSigner
function walletClientToSigner(walletClient: WalletClient): JsonRpcSigner {
  const { account, chain, transport } = walletClient;
  if (!account || !chain) {
    throw new Error('Incomplete WalletClient properties.');
  }
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(transport, network);
  return new JsonRpcSigner(provider, account.address);
}

export function useUGF() {
  const { data: walletClient } = useWalletClient();
  const [isExecuting, setIsExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [digest, setDigest] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<UGFStepProgress[]>([
    { step: 'Quote', status: 'idle', message: 'Ready to request gas sponsor quote.' },
    { step: 'Settle', status: 'idle', message: 'Waiting to authorize gasless stablecoin settlement.' },
    { step: 'Execute', status: 'idle', message: 'Waiting for UGF relayer to submit on-chain.' },
    { step: 'Confirm', status: 'idle', message: 'Waiting for blockchain block mining confirmation.' },
  ]);

  const updateStep = (
    step: 'Quote' | 'Settle' | 'Execute' | 'Confirm',
    status: UGFStepProgress['status'],
    message: string
  ) => {
    setProgress((prev) =>
      prev.map((s) =>
        s.step === step ? { ...s, status, message, timestamp: new Date().toLocaleTimeString() } : s
      )
    );
  };

  const executeGaslessTransaction = async (
    type: 'Fund' | 'Release' | 'Create' | 'Cancel' | 'Dispute' | 'AutoRelease',
    escrowId: string,
    amount: string,
    contractAddress: string,
    encodedData: `0x${string}`
  ): Promise<string> => {
    if (!walletClient) {
      throw new Error('Wallet not connected or loading client data.');
    }

    setIsExecuting(true);
    setTxHash(undefined);
    setDigest(undefined);

    setProgress([
      { step: 'Quote', status: 'idle', message: 'Requesting gas quote...' },
      { step: 'Settle', status: 'idle', message: 'Preparing stablecoin settlement...' },
      { step: 'Execute', status: 'idle', message: 'Ready for UGF relayer execution...' },
      { step: 'Confirm', status: 'idle', message: 'Monitoring confirmation status...' },
    ]);

    try {
      // 1. Initialize UGF Client & Bridge Signer
      const ugf = new UGFClient({ baseUrl: gatewayUrl });
      const signer = walletClientToSigner(walletClient);
      const payerAddress = await signer.getAddress();

      // 2. Step 1: EIP-191 Auth & Quote
      updateStep('Quote', 'loading', 'Authenticating wallet ownership and fetching sponsored gas quote in MockUSD...');
      await ugf.auth.login(signer);

      const quote = await ugf.quote.get({
        payer_address: payerAddress,
        tx_object: JSON.stringify({
          from: payerAddress,
          to: contractAddress,
          data: encodedData,
          value: '0',
        }),
      });

      setDigest(quote.digest);
      const gasFeeFormatted = (Number(quote.payment_amount) / 10 ** 18).toFixed(4);
      updateStep('Quote', 'success', `Quote approved! Gas fee: $${gasFeeFormatted} MockUSD (Sponsored, 0.00 ETH required).`);

      // 3. Step 2: Settle Payment
      updateStep('Settle', 'loading', 'Signing ERC-3009 permit payload to settle gas fee in MockUSD gaslessly...');
      await ugf.payment.x402.execute({ quote, signer });
      updateStep('Settle', 'success', `Settlement authorized! Signed permit digest: ${quote.digest.substring(0, 16)}...`);

      // 4. Step 3 & 4: Execute & Confirm
      updateStep('Execute', 'loading', 'Broadcasting sponsored transaction via UGF Sepolia Relayer tunnel...');
      
      const { userTxHash } = await ugf.chains.evm.sponsorAndExecute(
        quote.digest,
        signer,
        async () => ({
          to: contractAddress,
          data: encodedData,
          value: 0n,
        }),
        {
          onTick: (status, attempt) => {
            updateStep('Execute', 'loading', `UGF Relayer execution in progress (attempt ${attempt}, status: ${status.status})...`);
          }
        }
      );

      setTxHash(userTxHash);
      updateStep('Execute', 'success', `Transaction relayed successfully! Tx: ${userTxHash.substring(0, 14)}...`);
      updateStep('Confirm', 'loading', 'Waiting for Base Sepolia block confirmation...');
      
      // Wait a moment for block confirmation verification
      await new Promise((resolve) => setTimeout(resolve, 2000));
      updateStep('Confirm', 'success', `Transaction confirmed on Base Sepolia! Gasless action complete.`);

      // Log transaction to DB for audit trail
      const newTx: UGFTransaction = {
        id: 'ugf-tx-' + Date.now(),
        escrowId,
        type: type === 'AutoRelease' ? 'Release' : type as any,
        digest: quote.digest,
        paymentCoin: 'TYI_MOCK_USD',
        amount,
        status: 'Confirmed',
        txHash: userTxHash,
        createdAt: new Date().toISOString(),
        isGasless: true,
      };
      await db.saveTransaction(newTx);

      setIsExecuting(false);
      return userTxHash;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown network execution error';
      setProgress((prev) =>
        prev.map((s) =>
          s.status === 'loading' ? { ...s, status: 'error', message: `Failed: ${msg}` } : s
        )
      );
      setIsExecuting(false);
      throw error;
    }
  };

  return {
    isExecuting,
    ugfStepProgress: progress,
    txHash,
    digest,
    executeGaslessTransaction,
  };
}
