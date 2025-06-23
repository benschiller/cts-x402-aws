import { config } from "dotenv";
import express, { Request, Response, Application } from "express";
import { paymentMiddleware } from "x402-express";
import fetch from "node-fetch";
import { distributeIncomingPayment, validateAddresses } from "./smartDistribution.js";

// Load environment variables from .env file
config();

// Hardcoded for demo
const REPORTS_API_BASE = "https://cryptotwitter.space";

// Validate and get the receiving wallet address from environment variables
const RECEIVING_WALLET_ADDRESS = process.env.RECEIVING_WALLET_ADDRESS as `0x${string}`;
if (!RECEIVING_WALLET_ADDRESS) {
  throw new Error("RECEIVING_WALLET_ADDRESS is not set in .env file");
}

// Validate distribution addresses on startup
console.log("🔍 Validating distribution addresses...");
if (!validateAddresses()) {
  console.error("❌ Address validation failed. Please check your .env file.");
  process.exit(1);
}

const app: Application = express();
app.use(express.json());

// Add debug logging middleware BEFORE payment middleware
app.use((req, res, next) => {
  console.log(`\n=== INCOMING REQUEST ===`);
  console.log(`${req.method} ${req.path}`);
  console.log(`Full URL: ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('========================\n');
  next();
});

// Add the global payment middleware with dynamic route pattern
app.use(paymentMiddleware(
  RECEIVING_WALLET_ADDRESS,
  {
    // Use a pattern that matches your dynamic route
    "GET /get-report-resource/*": { // Wildcard to match any report ID
      price: "$0.01",
      network: "base-sepolia",
    },
  },
  {
    url: "https://www.x402.org/facilitator",
  }
));

// Helper function for making HTTP requests
async function makeHttpRequest<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    } else {
      return (await response.text()) as T;
    }
  } catch (error) {
    console.error("Error making HTTP request:", error);
    return null;
  }
}

interface Report {
  id: string;
  status: string;
  curator_user_id: string;
  space_title: string;
}

interface ReportsApiResponse {
  data: Report[];
  hasMore: boolean;
}

// Route for search-reports (remains free)
app.get("/search-reports", async (req: Request, res: Response) => {
  const query = req.query.query as string;

  if (!query) {
    res.status(400).json({ error: "Query parameter is required." });
    return;
  }

  const reportsUrl = `${REPORTS_API_BASE}/api/reports?page=1`;
  const reportsData = await makeHttpRequest<ReportsApiResponse>(reportsUrl);

  if (!reportsData) {
    res.status(500).json({ error: "Failed to retrieve reports data." });
    return;
  }

  const filteredReports = reportsData.data.filter(report =>
    report.space_title.toLowerCase().includes(query.toLowerCase())
  );

  if (filteredReports.length === 0) {
    res.status(200).json({ message: `No reports found matching "${query}".` });
    return;
  }

  const reportSummaries = filteredReports.map(report => ({
    id: report.id,
    title: report.space_title,
  }));

  res.json(reportSummaries);
});

// Route for browse-reports (remains free)
app.get("/browse-reports", async (req: Request, res: Response) => {
  const reportsUrl = `${REPORTS_API_BASE}/api/reports?page=1`; // Assuming page=1 for MVP
  const reportsData = await makeHttpRequest<ReportsApiResponse>(reportsUrl);

  if (!reportsData) {
    res.status(500).json({ error: "Failed to retrieve reports data." });
    return;
  }

  const reportSummaries = reportsData.data.map(report => ({
    id: report.id,
    title: report.space_title,
  }));

  res.json(reportSummaries);
});

// Route for get-report-resource (paid) - now with CDP Wallet API v2 distribution
app.get(
  "/get-report-resource/:reportId",
  async (req: Request, res: Response) => {
    console.log("💰 Payment validated! Processing paid request...");
    const reportId = req.params.reportId;

    try {
      // First, get the report content
      console.log(`📄 Fetching report content for ID: ${reportId}`);
      const reportContentUrl = `${REPORTS_API_BASE}/api/report-resource/${reportId}`;
      const reportContent = await makeHttpRequest<string>(reportContentUrl);

      if (reportContent === null) {
        res.status(500).json({ error: `Failed to retrieve content for report ID: ${reportId}.` });
        return;
      }

      console.log(`✅ Content retrieved successfully for report ID: ${reportId}`);

      // 🚀 TRIGGER AUTOMATED PAYMENT DISTRIBUTION VIA CDP Wallet API v2
      console.log("🔄 Initiating automated payment distribution...");
      
      // Fire-and-forget distribution (don't wait for completion)
      distributeIncomingPayment({
        amountPaid: 0.01,
        // currency: "USDC",
        // network: "base-sepolia"
      }).then(() => {
        console.log("🎉 Payment distribution completed successfully!");
      }).catch(error => {
        console.error("❌ Payment distribution failed:", error);
        // In production, you might want to:
        // 1. Queue for retry
        // 2. Send alert to monitoring system
        // 3. Log to database for reconciliation
      });

      // Immediately serve content to user (don't wait for distribution)
      console.log("📤 Serving content to user while distribution processes...");
      res.send(reportContent);

    } catch (error) {
      console.error("❌ Error in get-report-resource:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Health check endpoint with distribution config info
app.get("/health", (req: Request, res: Response) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    receivingWallet: RECEIVING_WALLET_ADDRESS,
    distributionEnabled: true,
    usdcContract: process.env.USDC_CONTRACT_ADDRESS
  });
});

// New endpoint to check distribution configuration
app.get("/distribution-config", (req: Request, res: Response) => {
  res.json({
    hostAddress: process.env.HOST_ADDRESS,
    curatorAddress: process.env.CURATOR_ADDRESS,
    platformAddress: process.env.PLATFORM_ADDRESS,
    splits: {
      host: "50%",
      curator: "30%", 
      platform: "20%"
    },
    contracts: {
      usdc: process.env.USDC_CONTRACT_ADDRESS
    }
  });
});

const PORT = 4021;

app.listen(PORT, () => {
  console.log(`\n🚀 x402 Express Server with CDP Wallet API v2 Integration`);
  console.log(`📡 Listening at: http://localhost:${PORT}`);
  console.log(`💳 Receiving payments at: ${RECEIVING_WALLET_ADDRESS}`);
  console.log(`🪙 USDC contract: ${process.env.USDC_CONTRACT_ADDRESS}`);
  console.log(`🔄 Automated 3-way distribution: ENABLED`);
  console.log(`   📍 Host (50%): ${process.env.HOST_ADDRESS}`);
  console.log(`   📍 Curator (30%): ${process.env.CURATOR_ADDRESS}`);
  console.log(`   📍 Platform (20%): ${process.env.PLATFORM_ADDRESS}\n`);
});
