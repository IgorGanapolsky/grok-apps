import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  const target = targets.find(t => t.url.includes("play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820"));
  if (!target) {
    console.error("ERROR: No active Play Console app tab found.");
    process.exit(1);
  }

  console.log(`Connecting to target: "${target.title}"`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  const sendCommand = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1000000);
      const messageHandler = (event) => {
        const response = JSON.parse(event.data);
        if (response.id === id) {
          ws.removeEventListener("message", messageHandler);
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.result);
          }
        }
      };
      ws.addEventListener("message", messageHandler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  ws.onopen = async () => {
    try {
      await sendCommand("Page.enable");
      await sendCommand("Runtime.enable");

      // Navigate to Dashboard to make sure we're on the app page
      const dashboardUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-dashboard";
      console.log(`Navigating to Dashboard first: ${dashboardUrl}`);
      await sendCommand("Page.navigate", { url: dashboardUrl });
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Grab all link hrefs and texts
      const linksResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links.map(l => ({
            text: l.textContent.trim(),
            href: l.href
          })).filter(l => l.href.includes('play.google.com/console'));
        })()`,
        returnByValue: true
      });
      
      console.log("\n--- Found Play Console Links ---");
      for (const link of linksResult.result.value) {
        console.log(`- Text: "${link.text}", Href: "${link.href}"`);
      }
      console.log("---------------------------------\n");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
