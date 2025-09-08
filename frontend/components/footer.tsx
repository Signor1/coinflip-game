import { CoinflipAddress } from "@/lib/conflip";
import Link from "next/link";

export function Footer() {
  return (
    <div className="max-w-7xl w-full mx-auto flex items-center justify-center h-16">
      <Link
        href={`https://sepolia.arbiscan.io/address/${CoinflipAddress}`}
        target="_blank"
        className="text-sm text-gray-500 hover:text-blue-600"
      >
        View Coinflip on Arbiscan
      </Link>
    </div>
  );
}
