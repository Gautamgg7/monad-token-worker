var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// token.js
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
async function fetchSingleRequest(url, clientId) {
  if (!clientId) {
    throw new Error("THIRDWEB_CLIENT_ID is not configured");
  }
  const finalUrl = url.includes("clientId=") ? url : `${url}&clientId=${clientId}`;
  console.log("Making request to:", finalUrl);
  const response = await fetch(finalUrl, {
    headers: {
      "Accept": "application/json"
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Thirdweb API Error:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      url: finalUrl,
      clientId: clientId ? "present" : "missing"
    });
    throw new Error(`Thirdweb API error: ${response.status} - ${errorText}`);
  }
  return await response.json();
}
__name(fetchSingleRequest, "fetchSingleRequest");
function isNadNFT(nft, nadsContractAddress) {
  if (!nft)
    return false;
  let nftAddress = null;
  if (nft.contract && nft.contract.address) {
    nftAddress = nft.contract.address;
  } else if (nft.token_address) {
    nftAddress = nft.token_address;
  } else if (nft.asset_contract && nft.asset_contract.address) {
    nftAddress = nft.asset_contract.address;
  } else if (nft.contract_address) {
    nftAddress = nft.contract_address;
  }
  if (!nftAddress) {
    console.log("Could not extract address from NFT:", JSON.stringify(nft).substring(0, 200));
    return false;
  }
  const isNad = nftAddress.toLowerCase() === nadsContractAddress.toLowerCase();
  if (isNad) {
    console.log("Found NAD NFT with address:", nftAddress);
    console.log("NAD NFT details:", JSON.stringify({
      tokenId: nft.token_id || nft.tokenId || nft.id,
      name: nft.name || nft.metadata && nft.metadata.name,
      symbol: nft.symbol || nft.metadata && nft.metadata.symbol
    }));
  }
  return isNad;
}
__name(isNadNFT, "isNadNFT");
async function fetchPaginatedData(baseUrl, clientId, options = {}) {
  let allData = [];
  let currentPage = 0;
  let emptyResponseCount = 0;
  let isNadHolder = false;
  const nadsContractAddress = "0x922da3512e2bebbe32bcce59adf7e6759fb8cea2";
  const MAX_EMPTY_RESPONSES = 2;
  try {
    console.log(`Starting paginated fetch for ${baseUrl}`);
    while (emptyResponseCount < MAX_EMPTY_RESPONSES) {
      const pageUrl = `${baseUrl}&page=${currentPage}`;
      console.log(`Fetching page ${currentPage}: ${pageUrl}`);
      try {
        const pageResult = await fetchSingleRequest(pageUrl, clientId);
        console.log(`Page ${currentPage} response status: ${pageResult.data ? "has data" : "no data"}`);
        if (!pageResult.data || pageResult.data.length === 0) {
          console.log(`Empty data at page ${currentPage}, incrementing empty count`);
          emptyResponseCount++;
          currentPage++;
          continue;
        }
        emptyResponseCount = 0;
        console.log(`Page ${currentPage} has ${pageResult.data.length} items`);
        allData = [...allData, ...pageResult.data];
        if (options.checkForNad && !isNadHolder) {
          for (const nft of pageResult.data) {
            if (isNadNFT(nft, nadsContractAddress)) {
              console.log(`Found 1 Million Nad NFT in page ${currentPage}!`);
              isNadHolder = true;
              break;
            }
          }
        }
        currentPage++;
      } catch (error) {
        console.error(`Error fetching page ${currentPage}: ${error.message}`);
        emptyResponseCount++;
        currentPage++;
      }
    }
    if (options.checkForNad) {
      const directNadCheck = allData.some((nft) => isNadNFT(nft, nadsContractAddress));
      if (directNadCheck) {
        console.log("Verified 1 Million Nad NFT holder through direct check of all data");
        isNadHolder = true;
      }
    }
    console.log(`Pagination complete. Fetched ${allData.length} total items across ${currentPage} pages`);
    console.log(`Final Nad holder status: ${isNadHolder}`);
    return { data: allData, isNadHolder };
  } catch (error) {
    console.error("Error in main fetchPaginatedData function:", error);
    return { data: allData, isNadHolder };
  }
}
__name(fetchPaginatedData, "fetchPaginatedData");
function isValidApiKey(request, env) {
  const apiKey = request.headers.get("X-API-Key");
  return apiKey === env.PROTECTION_API_KEY;
}
__name(isValidApiKey, "isValidApiKey");
__name2(isValidApiKey, "isValidApiKey");
var index_default = {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      "Access-Control-Max-Age": "86400"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }
    if (!isValidApiKey(request, env)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Invalid or missing API key." }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      let response;
      const address = url.searchParams.get("address");
      if (!address) {
        throw new Error("Address parameter is required");
      }
      if (!env.THIRDWEB_CLIENT_ID) {
        throw new Error("THIRDWEB_CLIENT_ID is not configured in the worker");
      }
      const baseUrl = "https://insight.thirdweb.com/v1";
      const chain = "10143";
      if (path.includes("/erc20")) {
        const apiBaseUrl = `${baseUrl}/tokens/erc20/${address}?chain=${chain}&metadata=true&include_spam=true&limit=100`;
        const result = await fetchPaginatedData(apiBaseUrl, env.THIRDWEB_CLIENT_ID);
        response = { balances: result.data || [] };
        console.log("ERC20 response count:", result.data.length);
      } else if (path.includes("/erc721")) {
        const apiBaseUrl = `${baseUrl}/tokens/erc721/${address}?chain=${chain}&metadata=true&limit=100`;
        const result = await fetchPaginatedData(apiBaseUrl, env.THIRDWEB_CLIENT_ID, { checkForNad: true });
        const isNadHolder = result.isNadHolder;
        const nadsContractAddress = "0x922da3512e2bebbe32bcce59adf7e6759fb8cea2";
        const nadsNFTs = (result.data || []).filter(
          (nft) => isNadNFT(nft, nadsContractAddress)
        );
        console.log(`ERC721 response total count: ${result.data.length}`);
        console.log(`isNadHolder from pagination: ${isNadHolder}`);
        console.log(`Direct check found ${nadsNFTs.length} Nad NFTs`);
        console.log(`Final Nad holder status: ${isNadHolder || nadsNFTs.length > 0}`);
        response = {
          is1MillionNadHolder: isNadHolder || nadsNFTs.length > 0,
          nfts: result.data || []
        };
      } else if (path.includes("/erc1155")) {
        const apiBaseUrl = `${baseUrl}/tokens/erc1155/${address}?chain=${chain}&metadata=true&limit=100`;
        const result = await fetchPaginatedData(apiBaseUrl, env.THIRDWEB_CLIENT_ID);
        response = { balances: result.data || [] };
        console.log("ERC1155 response count:", result.data.length);
      } else {
        throw new Error("Invalid endpoint");
      }
      const responseSummary = JSON.stringify({
        ...response,
        nfts: response.nfts ? `[${response.nfts.length} items]` : void 0,
        balances: response.balances ? `[${response.balances.length} items]` : void 0
      });
      console.log(`Final response: ${responseSummary}`);
      return new Response(JSON.stringify(response), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } catch (error) {
      console.error("Worker Error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
          details: error instanceof Error ? error.stack : void 0
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=token.js.map
