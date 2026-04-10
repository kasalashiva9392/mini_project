const BASE_URL = process.env.API_URL || "http://localhost:5000";

async function assertOk(response, context) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${context} failed: ${response.status} ${text}`);
  }
}

async function main() {
  const health = await fetch(`${BASE_URL}/health`);
  await assertOk(health, "Health check");

  const healthData = await health.json();
  if (!healthData.ok) {
    throw new Error("Health payload invalid");
  }

  const login = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SMOKE_EMAIL || "admin@college.edu",
      password: process.env.SMOKE_PASSWORD || "Password@123",
    }),
  });
  await assertOk(login, "Auth login");
  const loginData = await login.json();
  if (!loginData.token) {
    throw new Error("Login response missing token");
  }

  const posts = await fetch(`${BASE_URL}/posts?page=1&limit=5`);
  await assertOk(posts, "Posts listing");

  console.log("Smoke test passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
