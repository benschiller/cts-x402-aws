# CryptoTwitter.Space Alpha Report Agent

## 🚀 Agents in Action Hackathon Entry

This project, **CryptoTwitter.Space Alpha Report Agent**, is an entry for the "Agents in Action" hackathon, showcasing the power of autonomous, on-chain commerce using **x402pay and CDP Wallet** with integrated **Amazon Bedrock, Nova Pro, App Runner, and Lambda**.

## ✨ Project Overview

This application acts as a micro-SaaS service, providing **gated, pay-per-use access to premium CryptoTwitter.Space reports**. It leverages `x402pay` for seamless monetization and `CDP Wallet` Smart Accounts to **automatically split and distribute revenue** among multiple stakeholders (host, content curator, and platform).

The innovation lies in its ability to empower **agentic commerce with automated payouts**, demonstrating a complete revenue-generating loop for digital content. Furthermore, it integrates with **Amazon Bedrock** to enable natural language interaction, allowing users to query and purchase reports using an AI agent.

## 💡 Problem Solved

In crypto, speed to signal is everything—but human traders can’t listen to every live conversation, and AI tools lack the context to know what matters most in real time.

What’s missing is a co-pilot agent: one that understands the trader’s intent, listens across live audio, extracts critical information, and delivers it at the exact moment it's needed—before the market reacts.

But the deeper problem is economic: valuable signals are being shared in public forums, but there’s no incentive for hosts, speakers, or curators to surface, structure, and distribute that information. The trader suffers because high-signal alpha is lost in the noise because the market has no mechanism to reward those who find it first.

**CryptoTwitter.Space Alpha Report Agent** solves the trader's problem by turning information into a monetizable asset class. Paid Alpha Reports are instantly revenue-shared via smart contracts between the Space host, the report curator, and the platform—creating a new incentive economy around signal discovery. This is the foundation of InfoFi: a financial layer for real-time information.

## ⚙️ Use Case: Searching for Base Alpha

A crypto trader wakes up to a fast-moving market and wants to catch up on overnight developments.

Instead of scrolling endlessly through X or listening to replays of Twitter Spaces, they visit **CryptoTwitter.Space** and enter a simple query:

> **Search:** “Base”

The **Alpha Report Agent** instantly returns a list of timestamped, curated reports generated from live Twitter Spaces where Base was discussed.

Each report includes:
- Key quotes and topic summaries  
- Bullish or bearish sentiment classifications  
- Links to the original audio for verification  
- Speaker breakdowns and emerging narrative tags

They pay a small fee to unlock the full report. Instantly:
- The **Host** that ran the show receives 50% of the payment  
- The **Curator** that generated the report gets 30%  
- The **Platform** retains 20%

By the end of the session, the trader has context others missed—and the ecosystem that surfaced the signal gets rewarded. The incentive flywheel turns.
 
## 🌟 Key Features

*   **Pay-per-Use Content Access (x402pay):** Monetizes access to premium CryptoTwitter.Space reports on a per-view basis.
*   **Automated Revenue Distribution (CDP Wallet Smart Account):** Implements a full payment loop where incoming `USDC` payments are automatically split and disbursed to:
    *   **Host (50%)**
    *   **Curator (30%)**
    *   **Platform (20%)**
*   **Composable & Modular Logic:** Designed for reusability, demonstrating a clear separation of concerns between payment handling and distribution.
*   **Natural Language Interface (Amazon Bedrock Agent):** Integrates with an Amazon Bedrock Agent (utilizing **Amazon Nova**) allowing users to search, browse, and access paid reports through conversational AI.
*   **Real-World Relevance:** Solves a tangible need for creators and platforms seeking to monetize digital assets and manage payouts efficiently on-chain.

## 📺 Demo

A video demonstration of the project is available here:
[Link to your Demo Video]

## 🛠️ Technologies Used

*   **x402pay:** For seamless pay-per-use monetization.
*   **Coinbase Developer Platform (CDP) Wallet:** For secure, programmable smart accounts and automated crypto flows.
*   **Express.js:** Backend API server (`src/x402ExpressServer.ts`).
*   **TypeScript / Node.js**
*   **AWS App Runner:** For hosting the `x402ExpressServer`.
*   **AWS Lambda:** As the Bedrock Agent Action Group Executor.
*   **Amazon Bedrock:** For the AI agent interface, specifically using **Amazon Nova**.
*   **viem:** For Ethereum interaction utilities.

## 🏆 How it Addresses Judging Criteria

This project directly tackles the hackathon's judging criteria:

*   **Effective use of both x402pay and CDP Wallet:** We demonstrate `x402pay` for charging users per query/report and `CDP Wallet` to manage the subsequent crypto flows, including splitting and disbursing funds automatically to multiple recipients.
*   **Completeness of payment loop: revenue in → payment out:** The system fully automates the process from a user making a payment via x402 to the subsequent distribution of funds to the host, curator, and platform wallets via CDP Wallet.
*   **Real-world relevance: solves an actual need or use case:** This project provides a tangible solution for content monetization and automated royalty/revenue distribution in the creator economy.
*   **Composability: reusable flows, templates, or modular logic:** The core payment and distribution logic is encapsulated in `src/smartDistribution.ts`, making it reusable. The Express server provides a clear API boundary.
*   **Creativity: novel agents or new financial primitives:** By combining pay-per-use access with automated, multi-party on-chain distribution orchestrated by an AI agent, it creates a novel financial primitive for content monetization.
*   **Technical execution: clean, working code with a video demo:** The codebase is well-structured, functional, and demonstrated via a comprehensive video.
*   **Effective and creative use of Amazon Bedrock (Bonus Prize):** The project fully integrates an Amazon Bedrock Agent leveraging **Amazon Nova** to act as the primary interface for users, demonstrating how AI can orchestrate complex on-chain financial workflows.

## ⚙️ Local Setup (for Judges)

To run the server locally:

1.  **Clone the repository:**
    ```bash
    git clone [your-repo-url]
    cd cts-aws
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and populate it with your specific API keys and addresses based on the provided `.env.example`.
    ```
    # Example .env content - FILL IN YOUR ACTUAL VALUES
    # x402 Express Server (Smart Account)
    RECEIVING_WALLET_ADDRESS=0x...

    # x402 User Agent
    PRIVATE_KEY=...

    # CDP Smart Account
    CDP_API_KEY_ID=...
    CDP_API_KEY_SECRET=...
    CDP_WALLET_SECRET=...

    # CDP Payouts
    HOST_ADDRESS=0x...
    CURATOR_ADDRESS=0x...
    PLATFORM_ADDRESS=0x...
    SMART_ACCOUNT_ADDRESS=0x...

    # USDC on Base Sepolia (example - verify current address)
    USDC_CONTRACT_ADDRESS=0x...

    # Reports Base URL (do not change for hackathon)
    REPORTS_API_BASE=https://cryptotwitter.space

    # MCP Server Path (not used for AWS Bedrock deployment)
    ARGS=/path/to/your/x402McpServer.js (leave empty or remove if not running locally with MCP server)
    ```
4.  **Run the server:**
    ```bash
    npm run start
    ```
    The server will start on `http://localhost:4021`.

## 📂 Project Structure
