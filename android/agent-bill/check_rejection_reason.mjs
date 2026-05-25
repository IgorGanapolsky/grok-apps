import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find Play Console dashboard target
  const target = targets.find(t => t.url.includes("play.google.com/console") && t.url.includes("/app/"));
  if (!target) {
    console.error("ERROR: No active Play Console app target found.");
    process.exit(1);
  }

  console.log(`Connecting to target: "${target.title}"`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  // Helper to send CDP command and return promise
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
      console.log("WebSocket opened. Enabling Page and Runtime domains...");
      await sendCommand("Page.enable");
      await sendCommand("Runtime.enable");

      console.log("Finding and clicking 'Go to Policy status' link...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const policyLink = links.find(a => a.textContent.includes('Go to Policy status'));
          if (policyLink) {
            policyLink.click();
            return { found: true, href: policyLink.href };
          }
          return { found: false };
        })()`,
        returnByValue: true
      });

      console.log("Click evaluation result:", clickResult.result.value);

      if (clickResult.result.value.found) {
        console.log("Clicked link successfully. Waiting 8s for the Policy status page to load...");
        await new Promise(resolve => setTimeout(resolve, 8000));
      } else {
        console.log("Could not find the link to click. Navigating directly to policy-status...");
        const currentUrl = target.url;
        const policyUrl = currentUrl.replace(/\/[^/]+$/, "/policy-status");
        console.log(`Navigating directly to: ${policyUrl}`);
        await sendCommand("Page.navigate", { url: policyUrl });
        console.log("Waiting 8s for navigation to complete...");
        await new Promise(resolve => setTimeout(resolve, 8000));
      }

      // Check the new URL
      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL after navigation: ${urlResult.result.value}`);

      // Capture innerText of the body to see the rejection reasons
      console.log("Retrieving page content...");
      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- Live Policy Status Content ---");
      const lines = pageText.split("\n");
      for (const line of lines) {
        const l = line.trim();
        if (l.length > 0 && (
          l.includes("rejection") || l.includes("Rejection") ||
          l.includes("policy") || l.includes("Policy") ||
          l.includes("violation") || l.includes("Violation") ||
          l.includes("issue") || l.includes("Issue") ||
          l.includes("status") || l.includes("Status") ||
          l.includes("rejected") || l.includes("Rejected") ||
          l.includes("reasons") || l.includes("Reasons") ||
          l.includes("com.iganapolsky.agentbill") ||
          l.length < 150 // Also log short descriptive lines
        )) {
          console.log(`  > ${l}`);
        }
      }
      console.log("----------------------------------\n");

      // Save page text for reference
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/policy_status_text.txt", pageText);

      // Take a screenshot
      console.log("Capturing screenshot of Policy status page...");
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/policy_status_screenshot.png";
      writeFileSync(screenshotPath, buffer);
      console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (err) {
      console.error("Error during execution:", err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
}

run().catch(console.error);
