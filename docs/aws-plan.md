# AWS Deployment and Amazon Bedrock Agent Integration Plan (Hackathon MVP)

This document outlines the simplest approach for deploying the `cts-aws` application to AWS and integrating it with an Amazon Bedrock Agent for the "Agents in Action" hackathon, focusing on an MVP.

## Core Principles

*   **Adapt Existing Codebase**: Leverage the existing `src/smartDistribution.ts` and `src/x402ExpressServer.ts` for their core functionality (CDP Wallet distribution, x402pay monetization).
*   **Minimalist Bedrock Integration**: Use Amazon Bedrock Agents (specifically, the `InvokeInlineAgent` API for simplicity) as the AI client, replacing the `x402McpServer.ts` for this deployment.
*   **Serverless First**: Prioritize managed AWS services to reduce operational overhead for a hackathon MVP.

## Architecture Overview

The system will consist of three main components in AWS:

1.  **`x402ExpressServer` (Deployed on AWS App Runner)**: This is your primary application backend, handling API requests, x402 payment middleware, and triggering CDP Wallet distribution.
2.  **AWS Lambda Function (Adapter)**: This function will act as an intermediary, invoked by the Amazon Bedrock Agent to call your `x402ExpressServer`'s API endpoints.
3.  **Amazon Bedrock Agent (Invoked Inline)**: This is the AI client that interprets user natural language, orchestrates calls to your Lambda adapter (and thus your `x402ExpressServer`), and returns responses.

## Detailed Steps

### 1. Deploy `src/x402ExpressServer.ts` to AWS App Runner

*   **Service**: AWS App Runner.
*   **Purpose**: Host the Express.js server, exposing endpoints like `/search-reports` (free) and `/get-report-resource/:reportId` (paid).
*   **Configuration**:
    *   Point App Runner to your source code repository.
    *   Configure Node.js runtime.
    *   Set environment variables (e.g., `RECEIVING_WALLET_ADDRESS`, `REPORTS_API_BASE`, `HOST_ADDRESS`, `CURATOR_ADDRESS`, `PLATFORM_ADDRESS`, `USDC_CONTRACT_ADDRESS`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, `SMART_ACCOUNT_ADDRESS`).
    *   Ensure the `REPORTS_API_BASE` points to the actual reports API (e.g., `https://cryptotwitter.space`).

### 2. Create an AWS Lambda Function (Bedrock Agent Adapter)

*   **Runtime**: Node.js (recommended, given existing codebase)
*   **Purpose**: This Lambda will serve as the "Action Group Executor" for your Bedrock Agent. It will parse the incoming Bedrock event, make an HTTP request to your `x402ExpressServer`, and format the response back for the agent. This is the **preferred approach for autonomous agents** over "returning control" to the invoking application.
*   **Logic**:
    *   The Lambda function will receive an `event` object from the Bedrock Agent. For action groups defined with an OpenAPI schema, the key fields in this `event` will be:
        *   `event['apiPath']`: The specific API path the agent wants to invoke (e.g., `/search-reports`, `/browse-reports`, `/get-report-resource/{reportId}`).
        *   `event['httpMethod']`: The HTTP method (e.g., `GET`).
        *   `event['parameters']`: An array of objects, each containing `name` and `value` for extracted path or query parameters (e.g., `[{ "name": "query", "value": "some search term" }]` or `[{ "name": "reportId", "value": "123" }]`).
    *   The Lambda's code will parse these fields to determine which endpoint on your deployed `x402ExpressServer` to call.
    *   It will construct the appropriate URL for your App Runner service (e.g., `https://your-apprunner-url/get-report-resource/${event.parameters.find(p => p.name === 'reportId').value}`).
    *   It will make an HTTP GET request to this URL.
    *   Upon receiving a response from `x402ExpressServer`, the Lambda will format it into the Bedrock-expected response structure:

    ```json
    {
        "messageVersion": "1.0",
        "response": {
            "actionGroup": "YourActionGroupName", // e.g., "ReportActions"
            "apiPath": "/your-api-path",          // e.g., "/get-report-resource/123"
            "httpMethod": "GET",
            "httpStatusCode": 200,                // Or appropriate HTTP status code
            "responseBody": {
                "application/json": {             // Or other content type if applicable
                    "body": "JSON-formatted string of the response from x402ExpressServer"
                }
            }
        },
        "sessionAttributes": {}, // Optional, can be passed through
        "promptSessionAttributes": {} // Optional, can be passed through
    }
    ```
    *   It's crucial to `JSON.stringify()` the response from `x402ExpressServer` before placing it in the `body` field.

### 3. Define an OpenAPI Schema for Bedrock Agent Action Group

*   **Format**: OpenAPI 3.0.0 YAML.
*   **Purpose**: This schema tells the Bedrock Agent what actions it can perform, what parameters they require, and what responses to expect. It's vital for the agent's reasoning. Ensure `description` fields are highly informative for the agent.
*   **Key Fields**:
    *   `operationId`: A unique string for each operation (e.g., `searchReports`, `browseReports`, `getReportResource`). This is required and is used by "toolUse enabled models" like Claude 3.5 Sonnet and Amazon Nova.
*   **Content (Example)**:

    ```yaml
    openapi: 3.0.0
    info:
      title: CryptoTwitter.Space Reports API
      version: 1.0.0
      description: API for searching, browsing, and retrieving content from CryptoTwitter.Space reports.
    paths:
      /search-reports:
        get:
          summary: Search CryptoTwitter.Space reports by title.
          description: "Searches for reports whose titles contain the provided query string. This is a free operation."
          operationId: searchReports
          parameters:
            - name: query
              in: query
              description: A keyword or phrase to search for in report titles.
              required: true
              schema:
                type: string
          responses:
            '200':
              description: A list of report summaries matching the query.
              content:
                application/json:
                  schema:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: The unique ID of the report.
                        title:
                          type: string
                          description: The title of the report.
            '400':
              description: Bad request, query parameter is missing.
            '500':
              description: Internal server error.

      /browse-reports:
        get:
          summary: Browse all available CryptoTwitter.Space reports.
          description: "Retrieves a list of all available reports. This is a free operation and returns the first page of results."
          operationId: browseReports
          responses:
            '200':
              description: A list of all report summaries.
              content:
                application/json:
                  schema:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: The unique ID of the report.
                        title:
                          type: string
                          description: The title of the report.
            '500':
              description: Internal server error.

      /get-report-resource/{reportId}:
        get:
          summary: Retrieve the full content of a CryptoTwitter.Space report.
          description: "Retrieves the full markdown content of a CryptoTwitter.Space report by its ID. This is a PAID operation that costs $0.01 per access and will automatically process payment via x402."
          operationId: getReportResource
          parameters:
            - name: reportId
              in: path
              description: The unique ID of the report to retrieve content for.
              required: true
              schema:
                type: string
          # Consider adding x-requireConfirmation: true for paid operations, but optional for MVP
          # x-requireConfirmation: true
          responses:
            '200':
              description: The full markdown content of the report.
              content:
                text/plain: # Assuming the report content is plain markdown text
                  schema:
                    type: string
                    description: The complete markdown content of the report.
            '402':
              description: Payment required.
            '404':
              description: Report not found.
            '500':
              description: Internal server error.
    ```

### 4. Programmatic Invocation of an Amazon Bedrock Agent (Inline Agent)

*   **Method**: Use the AWS SDK (AWS SDK for JavaScript/TypeScript) to call the `InvokeInlineAgent` API.
*   **Configuration in `InvokeInlineAgent` call**:
    *   `instruction`: Provide clear instructions for the agent (e.g., "You are an assistant that helps users find and retrieve CryptoTwitter.Space reports. Some reports require payment.").
    *   `foundationModel`: Specify the desired model **Amazon Nova**.
    *   `actionGroups`: An array defining your tools. Each entry will include:
        *   `name` (e.g., "ReportActions")
        *   `apiSchema`: Your OpenAPI YAML content (from step 3, parsed as a string).
        *   `actionGroupExecutor`: An object with `lambda` pointing to the ARN of your Lambda function (from step 2).
    *   `inputText`: The user's query.
    *   `sessionId`: A unique identifier to maintain conversation history.
*   **Benefit for MVP**: Avoids console-based agent creation, versioning, and alias management, simplifying deployment for rapid iteration.

### 5. IAM Permissions

*   **Bedrock Agent Service Role (for inline invocation)**: The IAM role used by the entity calling `InvokeInlineAgent` will need:
    *   `bedrock:InvokeInlineAgent`
    *   `bedrock:InvokeModel` (for the chosen FM)
    *   `lambda:InvokeFunction` (for your Lambda adapter's ARN).
*   **Lambda Function Execution Role**: This role will need:
    *   `lambda:InvokeFunction` (basic Lambda permissions).
    *   Permissions to make outbound HTTP requests (e.g., `ec2:CreateNetworkInterface`, `ec2:DescribeNetworkInterfaces`, `ec2:DeleteNetworkInterface` if the App Runner service is in a private VPC, or just basic internet access if public).

### What about `src/x402McpServer.ts`?

*   For this AWS deployment using an Amazon Bedrock Agent as the client, `src/x402McpServer.ts` (which currently uses `StdioServerTransport` for Cline) will **not be needed**. The Bedrock Agent + Lambda will effectively replace its role as the client interface to your Express server.

This plan maintains the core logic you've already built while adopting a serverless-friendly, Bedrock-native approach for the AI agent integration, which should serve well for the hackathon MVP.
