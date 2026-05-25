import { writeFileSync } from "node:fs";

async function run() {
  const targetId = "6EDFA1792D04B07000E9749AE299E980";
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.id === targetId);
  
  if (!target) {
    console.error(`ERROR: Target with ID ${targetId} not found.`);
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

      console.log("Clicking 'Manage track' button...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent.includes('Manage track'));
          if (btn) {
            btn.click();
            return "SUCCESS: Clicked Manage track button";
          }
          return "ERROR: Manage track button not found";
        })()`,
        returnByValue: true
      });
      console.log("Click status:", clickResult.result.value);

      console.log("Waiting 8s for the track management page to load...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current loaded URL: ${urlResult.result.value}`);

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- Track Page Content ---");
      const lines = pageText.split("\n");
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("--------------------------\n");

      // Save page text
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/track_page_text.txt", pageText);

      // Find interactive elements on track page (especially tabs like "Testers", "Releases", etc.)
      const interactiveElements = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const els = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'));
          return els.map((el, i) => ({
            index: i,
            tagName: el.tagName,
            type: el.type || el.getAttribute('role'),
            text: el.innerText ? el.innerText.trim() : '',
            id: el.id,
            className: el.className,
            href: el.href
          })).filter(el => el.text || el.href);
        })()`,
        returnByValue: true
      });
      console.log("Interactive elements:");
      console.log(JSON.stringify(interactiveElements.result.value, null, 2));

      // Take screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/track_page.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
