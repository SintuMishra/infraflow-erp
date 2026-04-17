const DEFAULT_BASE_URL = "http://127.0.0.1:5001/api";

const resolveSmokeBaseUrls = (rawBaseUrl = process.env.SMOKE_BASE_URL) => {
  const primary = String(rawBaseUrl || "").trim() || DEFAULT_BASE_URL;
  const candidates = [primary];

  if (primary.includes("localhost")) {
    candidates.push(primary.replace("localhost", "127.0.0.1"));
  } else if (primary.includes("127.0.0.1")) {
    candidates.push(primary.replace("127.0.0.1", "localhost"));
  }

  return [...new Set(candidates)];
};

const createSmokeFetch = (baseUrls) => {
  let activeBaseUrl = null;

  const request = async (path, options = {}) => {
    const attempts = [];

    for (const baseUrl of baseUrls) {
      try {
        const response = await fetch(`${baseUrl}${path}`, options);
        activeBaseUrl = baseUrl;
        return response;
      } catch (error) {
        attempts.push({
          baseUrl,
          message: error?.message || String(error),
        });
      }
    }

    const networkError = new Error(`Unable to reach API endpoint: ${path}`);
    networkError.details = {
      baseUrls,
      attempts,
    };
    throw networkError;
  };

  request.getActiveBaseUrl = () => activeBaseUrl;

  return request;
};

module.exports = {
  createSmokeFetch,
  resolveSmokeBaseUrls,
};
