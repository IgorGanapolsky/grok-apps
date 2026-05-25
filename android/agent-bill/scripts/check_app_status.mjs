import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find Play Console target (Home page)
  const target = targets.find(t => t.url.includes("play.google.com/console"));
  if (!target) {
    console.error("ERROR: No active Play Console tab found.");
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

      // Navigate to Home page first to click and establish the app context
      console.log("Navigating to App List (Home)...");
      await sendCommand("Page.navigate", { url: "https://play.google.com/console/u/0/developers/8239620436488925047/app-list" });
      await new Promise(resolve => setTimeout(resolve, 8000));

      console.log("Locating the link for AgentBill app ID 4973243580627455820...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const agentBillLink = document.querySelector('a[href*="/app/4973243580627455820/"]');
          if (agentBillLink) {
            agentBillLink.click();
            return { clicked: true, text: agentBillLink.textContent.trim(), href: agentBillLink.href };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });

      console.log("Click result:", clickResult.result.value);
      console.log("Waiting 8s for app dashboard to load...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current active URL: ${urlResult.result.value}`);

      const pageTextResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const text = pageTextResult.result.value;

      console.log("\n--- Dashboard Content ---");
      const lines = text.split("\n");
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        const l = lines[i].trim();
        if (l.length > 0) {
          console.log(`  > ${l}`);
        }
      }
      console.log("-------------------------\n");

      // Save screenshot of Dashboard
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/current_dashboard_state.png", buffer);
      console.log("Dashboard screenshot saved to current_dashboard_state.png.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
