import https from "node:https";

const targets = [
  "https://www.solvatrade.co.ke/dashboard",
  "https://solvatrade.co.ke",
];

function check(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 15000 }, (response) => {
      response.resume();
      resolve({
        url,
        statusCode: response.statusCode,
        server: response.headers.server ?? "",
        location: response.headers.location ?? "",
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error(`Timed out checking ${url}`));
    });
    request.on("error", reject);
  });
}

const results = await Promise.all(
  targets.map((target) =>
    check(target).catch((error) => ({
      url: target,
      error: error instanceof Error ? error.message : String(error),
    })),
  ),
);
let failed = false;

for (const result of results) {
  if ("error" in result) {
    failed = true;
    console.log(`fail ${result.url}`);
    console.log(`  error: ${result.error}`);
    continue;
  }
  const ok = result.statusCode && result.statusCode >= 200 && result.statusCode < 400;
  failed ||= !ok;
  console.log(`${ok ? "ok" : "fail"} ${result.statusCode} ${result.url}`);
  if (result.server) console.log(`  server: ${result.server}`);
  if (result.location) console.log(`  location: ${result.location}`);
}

if (failed) process.exit(1);
