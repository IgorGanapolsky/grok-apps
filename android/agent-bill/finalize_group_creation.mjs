import { writeFileSync } from "node:fs";

async function run() {
  const targetId = "DB9DA0FBA61BFC3E178AE8E7C3DC7B3E";
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

      console.log("Clicking 'Create group' button on Step 3...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('[role="button"]'));
          // Find the one that actually says 'Create group' and has class 'RDPZE' or similar active state
          const createBtn = buttons.find(el => {
            const hasText = el.innerText && el.innerText.trim() === 'Create group';
            const isVisible = el.offsetParent !== null;
            const isNotDisabled = !el.getAttribute('aria-disabled') || el.getAttribute('aria-disabled') === 'false';
            return hasText && isVisible && isNotDisabled;
          });

          if (createBtn) {
            createBtn.click();
            return "SUCCESS: Clicked Create group button";
          }

          // Fallback: search any element containing 'Create group'
          const allDivs = Array.from(document.querySelectorAll('div, span, button'));
          const fallbackBtn = allDivs.find(el => {
            const hasText = el.innerText && el.innerText.trim() === 'Create group';
            const isVisible = el.offsetParent !== null;
            return hasText && isVisible;
          });

          if (fallbackBtn) {
            fallbackBtn.click();
            return "SUCCESS: Clicked fallback Create group button";
          }

          return "ERROR: Create group button not found";
        })()`,
        returnByValue: true
      });
      console.log("Click result:", clickResult.result.value);

      console.log("Waiting 6s for group creation to complete/verify...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      console.log("\n--- Page Content After Create Group Click ---");
      const lines = textResult.result.value.split("\n");
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("---------------------------------------------\n");

      // Take screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/create_group_final_attempt.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
