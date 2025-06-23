import { CdpClient } from "@coinbase/cdp-sdk";
import { parseEther } from "viem";
import dotenv from "dotenv";

dotenv.config();

const cdp = new CdpClient();

async function runCdpSetup() {
  const owner = await cdp.evm.createAccount({});
  console.log("Created owner account:", owner.address);

  const smartAccount = await cdp.evm.createSmartAccount({
    owner,
  });
  console.log("Created smart account:", smartAccount.address);

  const result = await cdp.evm.sendUserOperation({
    smartAccount,
    network: "base-sepolia",
    calls: [
      {
        to: "0x0000000000000000000000000000000000000000",
        value: parseEther("0"),
        data: "0x",
      },
    ],
  });

  console.log("User operation status:", result.status);

  console.log("Waiting for user operation to be confirmed...");
  const userOperation = await cdp.evm.waitForUserOperation({
    smartAccountAddress: smartAccount.address,
    userOpHash: result.userOpHash,
  });

  if (userOperation.status === "complete") {
    console.log("User operation confirmed. Block explorer link:", `https://sepolia.basescan.org/tx/${userOperation.transactionHash}`);
  } else {
    console.log("User operation failed");
  }
}

runCdpSetup().catch(console.error);