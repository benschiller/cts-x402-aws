import { CdpClient } from "@coinbase/cdp-sdk";
import { config } from "dotenv";
import { parseAbi, encodeFunctionData, Calls } from "viem";

config();

// Environment variables for distribution
const DISTRIBUTION_CONFIG = {
  HOST_ADDRESS: process.env.HOST_ADDRESS as `0x${string}`,
  CURATOR_ADDRESS: process.env.CURATOR_ADDRESS as `0x${string}`,
  PLATFORM_ADDRESS: process.env.PLATFORM_ADDRESS as `0x${string}`,
  SPLITS: {
    HOST: 0.50,
    CURATOR: 0.30,
    PLATFORM: 0.20,
  },
};

// Contract addresses
const USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS as `0x${string}`;

// Smart account address - Hardcoded for troubleshooting
const SMART_ACCOUNT_ADDRESS = "0x816B7C866FbC2C12B9eCd4adD88f56Ae5E76D291" as `0x${string}`;

// Validate required environment variables
const requiredEnvVars = [
  "CDP_API_KEY_ID",
  "CDP_API_KEY_SECRET",
  "CDP_WALLET_SECRET",
  "HOST_ADDRESS",
  "CURATOR_ADDRESS",
  "PLATFORM_ADDRESS",
  "USDC_CONTRACT_ADDRESS",
  "SMART_ACCOUNT_ADDRESS"
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const cdpClient = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID!,
  apiKeySecret: process.env.CDP_API_KEY_SECRET!,
});

// Simplified initialization - get the owner account and then the smart account
let smartAccount: Awaited<ReturnType<typeof cdpClient.evm.getSmartAccount>>;

async function initializeSmartAccount() {
  try {
    console.log("🔍 Getting owner account...");
    const accountsResponse = await cdpClient.evm.listAccounts();
    
    if (accountsResponse.accounts.length === 0) {
      throw new Error("No EVM accounts found in the CDP project.");
    }
    
    const ownerAccount = accountsResponse.accounts[0];
    console.log(`✅ Owner account: ${ownerAccount.address}`);

    console.log("🔍 Getting smart account...");
    smartAccount = await cdpClient.evm.getSmartAccount({
      address: SMART_ACCOUNT_ADDRESS,
      owner: ownerAccount,
    });
    console.log(`✅ Smart Account: ${smartAccount.address}`);
  } catch (error) {
    console.error("💥 Error initializing smart account:", error);
    throw error;
  }
}

// Initialize immediately with robust error handling
(async () => {
  try {
    await initializeSmartAccount();
  } catch (error) {
    console.error("🚨 Fatal: Smart account initialization failed at startup. Lambda will not function correctly.", error);
    // Optionally re-throw or exit if this is a critical dependency for the Lambda to function
    // throw error; 
    // process.exit(1);
  }
})();


interface PaymentDistribution {
  amountPaid: number;
}

export async function distributeIncomingPayment({
  amountPaid,
}: PaymentDistribution): Promise<void> {
  console.log(`\n🚀 Starting payment distribution for $${amountPaid}`);

  // Ensure smart account is initialized
  if (!smartAccount) {
    console.log("⏳ Smart account not initialized. Waiting...");
    await initializeSmartAccount();
  }

  try {
    const hostAmount = amountPaid * DISTRIBUTION_CONFIG.SPLITS.HOST;
    const curatorAmount = amountPaid * DISTRIBUTION_CONFIG.SPLITS.CURATOR;
    const platformAmount = amountPaid * DISTRIBUTION_CONFIG.SPLITS.PLATFORM;

    console.log(`📊 Distribution breakdown:`);
    console.log(`   Host (50%): $${hostAmount.toFixed(6)}`);
    console.log(`   Curator (30%): $${curatorAmount.toFixed(6)}`);
    console.log(`   Platform (20%): $${platformAmount.toFixed(6)}`);

    // USDC uses 6 decimals, so multiply by 1_000_000
    const hostTokenAmount = Math.round(hostAmount * 1_000_000);
    const curatorTokenAmount = Math.round(curatorAmount * 1_000_000);
    const platformTokenAmount = Math.round(platformAmount * 1_000_000);

    console.log(`💰 Token amounts (micro-USDC):`);
    console.log(`   Host: ${hostTokenAmount}`);
    console.log(`   Curator: ${curatorTokenAmount}`);
    console.log(`   Platform: ${platformTokenAmount}`);

    const recipients: `0x${string}`[] = [
      DISTRIBUTION_CONFIG.HOST_ADDRESS,
      DISTRIBUTION_CONFIG.CURATOR_ADDRESS,
      DISTRIBUTION_CONFIG.PLATFORM_ADDRESS,
    ];

    const amounts = [hostTokenAmount, curatorTokenAmount, platformTokenAmount];

    const userOpHash = await executeBatchTransfer(recipients, amounts);

    console.log(`🎉 Batch payment distribution completed!`);
    console.log(`🔗 User Operation Hash: ${userOpHash}`);
    console.log(`💸 Total distributed: $${amountPaid} to ${recipients.length} recipients\n`);
  } catch (error) {
    console.error("💥 Error in payment distribution:", error);
    throw error;
  }
}

async function executeBatchTransfer(
  recipients: `0x${string}`[],
  amounts: number[]
): Promise<string> {
  console.log(`🔄 Executing batch transfer via CDP Smart Account...`);
  console.log(`🪙 Token: ${USDC_CONTRACT_ADDRESS}`);

  if (!smartAccount) {
    throw new Error("Smart account is not initialized. Cannot execute batch transfer.");
  }

  try {
    const erc20Abi = parseAbi([
      "function transfer(address to, uint256 amount) returns (bool)",
    ]);

    // Construct calls as a flat array of call objects
    const calls = recipients.map((recipient, index) => ({
      to: USDC_CONTRACT_ADDRESS,
      value: BigInt(0), // ERC20 transfers do not send ETH, so value is 0
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient, BigInt(amounts[index])],
      }),
    }));

    // Send user operation using the smartAccount object
    const result = await smartAccount.sendUserOperation({
      network: "base-sepolia",
      calls: calls as Calls<unknown[]>,
    });

    const userOpHash = result.userOpHash;

    console.log(`Waiting for user operation to be confirmed with hash: ${userOpHash}`);
    const userOperation = await smartAccount.waitForUserOperation({
      userOpHash,
    });

    if (userOperation.status === "complete") {
      const transactionHash = userOperation.transactionHash;
      console.log(`✅ Batch transfer successful! Transaction hash: ${transactionHash}`);
      console.log(`🔗 Block explorer link: https://sepolia.basescan.org/tx/${transactionHash}`);
      return transactionHash; // Return the actual transaction hash, not the userOpHash
    } else {
      throw new Error(`User operation failed with status: ${userOperation.status}`);
    }
  } catch (error) {
    console.error(`❌ Batch transfer failed:`, error);
    throw new Error(`Failed to execute batch transfer: ${error}`);
  }
}

export function validateAddresses(): boolean {
  const addresses: `0x${string}`[] = [
    DISTRIBUTION_CONFIG.HOST_ADDRESS,
    DISTRIBUTION_CONFIG.CURATOR_ADDRESS,
    DISTRIBUTION_CONFIG.PLATFORM_ADDRESS,
  ];

  for (const address of addresses) {
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error(`❌ Invalid address: ${address}`);
      return false;
    }
  }

  console.log(`✅ All distribution addresses validated`);
  return true;
}