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

      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('[role="button"]'));
          const nextBtn = buttons.find(el => {
            const hasNextText = el.innerText && el.innerText.trim() === 'Next';
            const isVisible = el.offsetParent !== null;
            const isNotDisabled = !el.getAttribute('aria-disabled') || el.getAttribute('aria-disabled') === 'false';
            return hasNextText && isVisible && isNotDisabled;
          });

          if (nextBtn) {
            nextBtn.click();
            return "SUCCESS: Clicked the visible active Next button";
          }

          // Fallback: search any element with text 'Next'
          const allDivs = Array.from(document.querySelectorAll('div, span, button'));
          const fallbackBtn = allDivs.find(el => {
            const hasNextText = el.innerText && el.innerText.trim() === 'Next';
            const isButtonLike = el.getAttribute('role') === 'button' || el.className.includes('uArJ5e');
            const isVisible = el.offsetParent !== null;
            return hasNextText && isButtonLike && isVisible;
          });

          if (fallbackBtn) {
            fallbackBtn.click();
            return "SUCCESS: Clicked fallback Next button";
          }

          return "ERROR: Could not find visible Next button";
        })()`,
        returnByValue: true
      });
      console.log("Click result:", clickResult.result.value);

      console.log("Waiting 3s for Step 2 to render...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      console.log("\n--- Page Content After Click ---");
      const lines = textResult.result.value.split("\n");
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("--------------------------------\n");

      // Take screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/create_group_step2_active.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
