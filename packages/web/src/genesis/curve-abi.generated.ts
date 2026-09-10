// Generated from packages/abi/MiniGenesisCurve.json. Do not edit.
export const curveAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "treasury_",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "allocation_",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "startPrice_",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "endPrice_",
        "type": "uint256"
      },
      {
        "internalType": "uint64",
        "name": "startTime_",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "endTime_",
        "type": "uint64"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AllocationExceeded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientPayment",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidConfiguration",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MathOverflowedMulDiv",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotActive",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RefundFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SlippageExceeded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TreasuryTransferFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroAmount",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "miniAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "dotCost",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalSoldMini",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalRaisedDot",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "spotPriceAfter",
        "type": "uint256"
      }
    ],
    "name": "Purchased",
    "type": "event"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  },
  {
    "inputs": [],
    "name": "MINI_UNIT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "allocation",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "miniAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "maxDotCost",
        "type": "uint256"
      }
    ],
    "name": "buyExactMini",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "buyerCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sold",
        "type": "uint256"
      }
    ],
    "name": "cumulativeCost",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "endPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "endTime",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "phase",
    "outputs": [
      {
        "internalType": "enum MiniGenesisCurve.Phase",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sold",
        "type": "uint256"
      }
    ],
    "name": "priceAt",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "purchasedMini",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "miniAmount",
        "type": "uint256"
      }
    ],
    "name": "quoteBuy",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "dotCost",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "remainingMini",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "soldOut",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "spotPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "startPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "startTime",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalRaisedDot",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSoldMini",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "treasury",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
