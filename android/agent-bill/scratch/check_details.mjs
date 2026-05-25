import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.url.includes("play.google.com/console") && (t.url.includes("policy-center") || t.url.includes("policy-status")));
  if (!target) {
    console.error("ERROR: Not currently on the Policy page.");
    process.exit(1);
  }

  console.log(`Connecting to: "${target.title}"`);
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

      console.log("Clicking 'View details'...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const viewDetails = elements.find(el => el.textContent.trim() === 'View details');
          if (viewDetails) {
            viewDetails.click();
            return { clicked: true, tag: viewDetails.tagName };
          }
          // Try to find any element with 'View details' inside it
          const viewDetailsPartial = elements.find(el => el.textContent.includes('View details') && el.children.length === 0);
          if (viewDetailsPartial) {
            viewDetailsPartial.click();
            return { clicked: true, partial: true, tag: viewDetailsPartial.tagName };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });

      console.log("Click result:", clickResult.result.value);

      console.log("Waiting 6s for the details to load...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL: ${urlResult.result.value}`);

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const detailedText = textResult.result.value;

      console.log("\n--- Page Content after click ---");
      const lines = detailedText.split("\n");
      for (let i = 0; i < Math.min(lines.length, 120); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("---------------------------------\n");

      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/policy_expanded_details.txt", detailedText);

      // Take a screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/policy_expanded_details_screenshot.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
