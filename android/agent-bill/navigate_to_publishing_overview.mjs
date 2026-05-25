import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find Play Console target
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

      console.log("Looking for 'Publishing overview' link in the sidebar...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const pubLink = links.find(a => a.textContent.includes('Publishing overview'));
          if (pubLink) {
            pubLink.scrollIntoView({ block: 'center' });
            pubLink.click();
            return { clicked: true, text: pubLink.textContent.trim(), href: pubLink.href };
          }
          
          // Try div/span with text
          const divs = Array.from(document.querySelectorAll('div, span, p'));
          const pubDiv = divs.find(el => el.textContent.trim() === 'Publishing overview');
          if (pubDiv) {
            pubDiv.scrollIntoView({ block: 'center' });
            pubDiv.click();
            return { clicked: true, text: 'Element click fallback', tag: pubDiv.tagName };
          }
          
          return { clicked: false, totalLinks: links.length };
        })()`,
        returnByValue: true
      });

      console.log("Click result:", clickResult.result.value);

      console.log("Waiting 10s for Publishing overview to load...");
      await new Promise(resolve => setTimeout(resolve, 10000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL: ${urlResult.result.value}`);

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- Page Content ---");
      const lines = pageText.split("\n");
      for (let i = 0; i < Math.min(lines.length, 30); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("--------------------\n");

      // Save page text
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/publishing_overview_text.txt", pageText);

      // Capture screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/publishing_overview_loaded.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
