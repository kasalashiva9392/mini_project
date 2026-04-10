/** Comma-separated browser origins, e.g. "https://app.example.com,https://www.example.com" */
function parseClientOrigins(clientUrl) {
  if (!clientUrl || typeof clientUrl !== "string") return [];
  return clientUrl
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = { parseClientOrigins };
