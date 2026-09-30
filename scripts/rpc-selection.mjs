export function isConfiguredRpcUrl(rpcUrl, configuredRpcUrls) {
  let normalizedRequested;
  try {
    normalizedRequested = new URL(rpcUrl).href;
  } catch {
    return false;
  }

  return configuredRpcUrls.some((configuredRpcUrl) => {
    try {
      return new URL(configuredRpcUrl).href === normalizedRequested;
    } catch {
      return false;
    }
  });
}
