import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  const target = targets.find(t => t.url.includes("play.google.com/console") && t.url.includes("app-dashboard"));
  if (!target) {
    console.error("ERROR: No active Play Console app-dashboard target found.");
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
      await sendCommand("Runtime.enable");

      // Expand "Show more" under "Get ready to publish your app"
      console.log("Looking for and clicking 'Show more'...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const links = Array.from(document.querySelectorAll('*'));
          const showMore = links.find(el => el.textContent.trim() === 'Show more');
          if (showMore) {
            showMore.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log("Click 'Show more' result:", clickResult.result.value);

      console.log("Waiting 3s for tasks to expand...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      const tasksResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Let's grab all text on the page related to tasks or lists
          const divs = Array.from(document.querySelectorAll('div, tr, li'));
          // Return unique non-empty text lines
          return Array.from(new Set(divs.map(el => el.textContent.trim()).filter(t => t.length > 0 && t.length < 300)));
        })()`,
        returnByValue: true
      });

      console.log("\n--- Unique text blocks on Dashboard ---");
      const textBlocks = tasksResult.result.value;
      for (let i = 0; i < Math.min(textBlocks.length, 100); i++) {
        console.log(`  > ${textBlocks[i]}`);
      }
      console.log("---------------------------------------\n");

      // Save screenshot of the expanded state
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/agentbill_dashboard_expanded.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
