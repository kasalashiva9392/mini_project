const { parseClientOrigins } = require("./parseClientOrigins");

/**
 * CORS / Socket.IO origin config. CLIENT_URL may be comma-separated (e.g. app + preview URLs).
 */
function getAllowedOrigins(env) {
  return parseClientOrigins(env.CLIENT_URL);
}

function getCorsOptions(env) {
  const origins = getAllowedOrigins(env);
  if (env.NODE_ENV === "production") {
    if (origins.length === 0) {
      console.warn(
        "[cors] NODE_ENV=production but CLIENT_URL is empty — set CLIENT_URL to your frontend origin(s).",
      );
    }
    return {
      origin: origins.length ? origins : false,
      credentials: true,
    };
  }
  return { origin: true, credentials: true };
}

function getSocketIoCorsOrigin(env) {
  const origins = getAllowedOrigins(env);
  if (env.NODE_ENV === "production") {
    return origins.length ? origins : false;
  }
  return true;
}

module.exports = { getAllowedOrigins, getCorsOptions, getSocketIoCorsOrigin };
