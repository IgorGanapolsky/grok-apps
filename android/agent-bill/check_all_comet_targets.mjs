async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  console.log("Targets count:", targets.length);
  for (const t of targets) {
    if (t.type === "page") {
      console.log(`- Title: "${t.title}", URL: "${t.url}", ID: "${t.id}"`);
    }
  }
}
run().catch(console.error);

