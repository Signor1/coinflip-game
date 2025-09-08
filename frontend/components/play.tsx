/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { CoinFlipModal, StatusStep } from "@/components/coin-flip-modal";
import { CoinflipABI, CoinflipAddress } from "@/lib/conflip";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import {
  formatEther,
  getContract,
  parseEther,
  parseEventLogs,
  publicActions,
} from "viem";
import { useAccount, useBalance, useWalletClient } from "wagmi";
import { BetOption, CoinOption } from "./options";

export function Play() {
  const [coinSide, setCoinSide] = useState<"heads" | "tails">("heads");
  const [betAmount, setBetAmount] = useState<string>("0.01");
  const [showModal, setShowModal] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipResult, setFlipResult] = useState<"heads" | "tails" | undefined>(
    undefined,
  );
  const [statusSteps, setStatusSteps] = useState<StatusStep[]>([]);

  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: coinflipBalance, refetch: refetchCoinflipBalance } = useBalance(
    {
      address: CoinflipAddress,
    },
  );
  const { data: userBalance, refetch: refetchUserBalance } = useBalance({
    address,
  });

  const canUserAffordBet =
    userBalance && userBalance.value >= parseEther(betAmount);
  const canContractAffordPayout =
    coinflipBalance &&
    coinflipBalance.value >= parseEther((Number(betAmount) * 0.01).toString());

  const handleFlip = async () => {
    // If the user is not connected, return
    if (!walletClient) return;
    // Configure the wallet client to also be able to call public functions (like waiting for txn receipts)
    const extendedClient = walletClient.extend(publicActions);

    // Show the coinflip modal, enable animation, and reset the result to undefined
    setShowModal(true);
    setIsFlipping(true);
    setFlipResult(undefined);

    // Initialize the coinflip contract
    const coinflip = getContract({
      abi: CoinflipABI,
      address: CoinflipAddress,
      client: walletClient,
    });

    // Add a status step to the status steps array
    setStatusSteps([
      {
        step: "Confirming transaction",
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    // Call the newGame function on the coinflip contract
    const newGameTx = await coinflip.write.newGame({
      value: parseEther(betAmount),
    });

    // Wait for the transaction to be mined
    const newGameReceipt = await extendedClient.waitForTransactionReceipt({
      hash: newGameTx,
    });

    // Add a status step to the status steps array
    setStatusSteps((prev) => [
      ...prev,
      { step: "Game started", timestamp: new Date().toLocaleTimeString() },
    ]);

    // Extract the GameCreated log from the transaction receipt
    // so we know the nonce of the game
    const gameCreatedLog: any = parseEventLogs({
      abi: coinflip.abi,
      logs: newGameReceipt.logs,
    }).find((log: any) => log.eventName === "GameCreated")!;

    // Create an event watcher on the contract looking for the GameResolved event
    // with a matching nonce
    const unwatch = extendedClient.watchContractEvent({
      fromBlock: newGameReceipt.blockNumber,
      address: coinflip.address,
      abi: coinflip.abi,
      eventName: "GameResolved",
      onLogs: async (logs: any) => {
        for (const log of logs) {
          // If we see a GameResolved event for a different nonce, ignore and move on
          if (log.args.nonce !== gameCreatedLog.args.nonce) continue;

          // If player won, set the flip result to the coin side they bet on
          // Otherwise, set the flip result to the opposite coin side
          const won = !!log.args.won;
          const result = won
            ? coinSide
            : coinSide === "heads"
              ? "tails"
              : "heads";

          // Add a status step to the status steps array
          setStatusSteps((prev) => [
            ...prev,
            {
              step: "Game resolved",
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);

          // Set the flip result, update the user and contract balances, and stop watching for events
          setFlipResult(result);
          setIsFlipping(false);
          refetchCoinflipBalance();
          refetchUserBalance();
          unwatch();
        }
      },
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setIsFlipping(false);
    setFlipResult(undefined);
    setStatusSteps([]);
  };

  return (
    <>
      <div className="flex flex-col gap-4 items-center">
        <div className="flex items-center gap-4">
          <CoinOption
            src="/heads.png"
            alt="heads"
            active={coinSide === "heads"}
            onClick={() => setCoinSide("heads")}
          />
          <CoinOption
            src="/tails.png"
            alt="tails"
            active={coinSide === "tails"}
            onClick={() => setCoinSide("tails")}
          />
        </div>

        <div className="flex items-center gap-4">
          <BetOption
            amount="0.01"
            active={betAmount === "0.01"}
            onClick={() => setBetAmount("0.01")}
          />
          <BetOption
            amount="0.05"
            active={betAmount === "0.05"}
            onClick={() => setBetAmount("0.05")}
          />
          <BetOption
            amount="0.1"
            active={betAmount === "0.1"}
            onClick={() => setBetAmount("0.1")}
          />
          <BetOption
            amount="0.5"
            active={betAmount === "0.5"}
            onClick={() => setBetAmount("0.5")}
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-gray-500">
            Bet: {betAmount} ETH on {coinSide === "heads" ? "Heads" : "Tails"}
          </span>
          <span className="text-sm text-gray-500">
            Potential Winnings: {Number(betAmount) * 1.9} ETH
          </span>
          <span className="text-sm text-gray-500">
            Coinflip contract balance:{" "}
            {formatEther(coinflipBalance?.value ?? BigInt(0))} ETH
          </span>
          {!canContractAffordPayout && (
            <span className="text-sm text-red-400">
              Coinflip contract balance is too low to pay out winnings for this
              bet
            </span>
          )}
          {!canUserAffordBet && (
            <span className="text-sm text-red-400">
              You don&apos;t have enough ETH to bet
            </span>
          )}
        </div>

        {isConnected ? (
          <button
            className="bg-blue-600 hover:bg-blue-700 transition-all font-medium text-white text-lg px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canUserAffordBet || !canContractAffordPayout}
            onClick={() =>
              handleFlip().catch((err) => {
                window.alert(err);
                closeModal();
              })
            }
          >
            Flip Coin
          </button>
        ) : (
          <ConnectButton />
        )}
      </div>

      <CoinFlipModal
        isOpen={showModal}
        isFlipping={isFlipping}
        won={flipResult === coinSide}
        statusSteps={statusSteps}
        onClose={closeModal}
      />
    </>
  );
}
