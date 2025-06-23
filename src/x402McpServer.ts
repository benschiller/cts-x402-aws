import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "dotenv";
import axios, { AxiosError } from "axios";
import { withPaymentInterceptor } from "x402-axios";
import { privateKeyToAccount } from "viem/accounts";

// Load environment variables
config();

// x402 payment setup
const rawPrivateKey = process.env.PRIVATE_KEY;
if (!rawPrivateKey) {
  throw new Error("PRIVATE_KEY is not set in .env file");
}

let formattedPrivateKey: `0x${string}`;
if (rawPrivateKey.startsWith('0x')) {
  formattedPrivateKey = rawPrivateKey as `0x${string}`;
} else {
  formattedPrivateKey = `0x${rawPrivateKey}` as `0x${string}`;
}

if (formattedPrivateKey.length !== 66) {
  throw new Error(`Invalid private key length: expected 66 characters (including 0x), got ${formattedPrivateKey.length}`);
}

const account = privateKeyToAccount(formattedPrivateKey);

// Create axios instances
const X402_SERVER_BASE = "http://localhost:4021"; // Your x402 Express server
const REPORTS_API_BASE = "http://localhost:3000"; // Direct API for free operations

// Payment-enabled axios for paid operations
const paymentAxios = withPaymentInterceptor(
  axios.create({ baseURL: X402_SERVER_BASE }),
  account
);

// Regular axios for free operations
const freeAxios = axios.create({ baseURL: REPORTS_API_BASE });

// Create server instance
const server = new McpServer({
  name: "cts-reports-x402",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Helper function for making HTTP requests
async function makeHttpRequest<T>(url: string): Promise<T | null> {
  try {
    const response = await freeAxios.get<T>(url);
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    // Axios automatically parses JSON if the content-type is application/json
    // Otherwise, it returns the data as is (string for text/plain etc.)
    return response.data;
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

// Register search-reports tool
server.tool(
  "search-reports",
  "Search CryptoTwitter.Space reports by title. This is a free operation.",
  {
    query: z.string().describe("A keyword or phrase to search for in report titles."),
  },
  async ({ query }) => {
    console.error(`🔍 Searching for reports matching: "${query}"`);
    
    const reportsUrl = `${REPORTS_API_BASE}/api/reports?page=1`; // Limit page for demo
    const reportsData = await makeHttpRequest<ReportsApiResponse>(reportsUrl);
    
    if (!reportsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve reports data.",
          },
        ],
      };
    }

    const filteredReports = reportsData.data.filter(report =>
      report.space_title.toLowerCase().includes(query.toLowerCase())
    );

    if (filteredReports.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No reports found matching "${query}".`,
          },
        ],
      };
    }

    const reportSummaries = filteredReports.map(report => ({
      id: report.id,
      title: report.space_title,
    }));

    console.error(`✅ Found ${reportSummaries.length} reports`);

    return {
      content: [
        {
          type: "text",
          text: `Found ${reportSummaries.length} reports matching "${query}":\n\n${JSON.stringify(reportSummaries, null, 2)}`,
        },
      ],
    };
  },
);

// Register browse-reports tool
server.tool(
  "browse-reports",
  "Browse all available CryptoTwitter.Space reports. This is a free operation and returns the first page of results.",
  {}, // No parameters
  async () => {
    console.error(`📚 Browsing all reports`);

    const reportsUrl = `${REPORTS_API_BASE}/api/reports?page=1`; // Limit page for demo
    const reportsData = await makeHttpRequest<ReportsApiResponse>(reportsUrl);

    if (!reportsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve reports data.",
          },
        ],
      };
    }

    // No filtering needed, return all data from the first page
    const reportSummaries = reportsData.data.map(report => ({
      id: report.id,
      title: report.space_title,
    }));

    if (reportSummaries.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No reports found.`,
          },
        ],
      };
    }

    console.error(`✅ Found ${reportSummaries.length} reports`);

    return {
      content: [
        {
          type: "text",
          text: `Found ${reportSummaries.length} reports:\n\n${JSON.stringify(reportSummaries, null, 2)}`,
        },
      ],
    };
  },
);

// Register get-report-resource tool (paid operation - goes through x402 server)
server.tool(
  "get-report-resource",
  "Retrieve the full markdown content of a CryptoTwitter.Space report by its ID. This is a PAID operation that costs $0.01 and will automatically process payment.",
  {
    reportId: z.string().describe("The ID of the report to retrieve content for."),
  },
  async ({ reportId }) => {
    try {
      console.error(`💰 Attempting to retrieve paid report content for ID: ${reportId}`);
      
      // Use the payment-enabled axios instance to call your x402 server
      const response = await paymentAxios.get(`/get-report-resource/${reportId}`);
      
      console.error(`✅ Successfully retrieved paid content for report ID: ${reportId}`);
      
      return {
        content: [
          {
            type: "text",
            text: `Report Content (ID: ${reportId}):\n\n${response.data}`,
          },
        ],
      };
    } catch (error: unknown) {
      console.error(`❌ Error retrieving report content for ID ${reportId}:`, (error as Error).message);
      
      let errorMessage = `Failed to retrieve content for report ID: ${reportId}.`;
      
      if ((error as AxiosError).response?.status === 402) {
        errorMessage += " Payment was required but could not be processed.";
      } else if (axios.isAxiosError(error) && error.response) {
        errorMessage += ` Server responded with status: ${error.response.status}`;
      }
      
      return {
        content: [
          {
            type: "text",
            text: errorMessage,
          },
        ],
      };
    }
  },
);

// Optional: Add a tool to check payment status or balance
server.tool(
  "get-payment-info",
  "Get information about the payment wallet being used for x402 transactions.",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: `Payment wallet address: ${account.address}\nNetwork: base-sepolia\nPrice per report: $0.01`,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("\n🚀 X402 Payment-Enabled Reports MCP Server running on stdio");
  console.log(`💳 Payment wallet: ${account.address}\n`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});