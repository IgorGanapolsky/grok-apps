async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  console.log("Total targets count:", targets.length);
  
  const redditTargets = targets.filter(t => 
    (t.url && t.url.includes("reddit.com")) || 
    (t.title && t.title.toLowerCase().includes("reddit"))
  );
  
  if (redditTargets.length === 0) {
    console.log("No Reddit targets found in the list.");
  } else {
    console.log("Found Reddit targets:");
    for (const t of redditTargets) {
      console.log(JSON.stringify(t, null, 2));
    }
  }
}
run().catch(console.error);
