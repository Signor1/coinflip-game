export const CoinflipAddress = "0x1dc256b484e1783b43ae6ed9485d3fa8beaf51af";

export const CoinflipABI = [
  { inputs: [], name: "GameAlreadyResolved", type: "error" },
  { inputs: [], name: "GameNotFound", type: "error" },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "InsufficientBalance",
    type: "error",
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "MinBetNotMet",
    type: "error",
  },
  { inputs: [], name: "OnlySupraRouter", type: "error" },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  { inputs: [], name: "RandomnessRequestFailed", type: "error" },
  { inputs: [], name: "TransferFailed", type: "error" },
  {
    inputs: [
      { internalType: "uint256", name: "nonce", type: "uint256" },
      { internalType: "uint256[]", name: "rng_list", type: "uint256[]" },
    ],
    name: "fulfillRandomness",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "newGame",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
