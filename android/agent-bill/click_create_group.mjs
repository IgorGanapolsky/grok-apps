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
      await sendCommand("Page.enable");
      await sendCommand("Runtime.enable");

      console.log("Clicking 'Create group' button...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(el => el.innerText.trim() === 'Create group');
          if (btn) {
            btn.click();
            return "SUCCESS: Clicked Create group button";
          }
          return "ERROR: Create group button not found";
        })()`,
        returnByValue: true
      });
      console.log(clickResult.result.value);

      console.log("Waiting 5s for group creation dialog/modal to appear...");
      await new Promise(resolve => setTimeout(resolve, 5000));

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- Active Page Content After Click ---");
      const lines = pageText.split("\n");
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("---------------------------------------\n");

      // Print input fields details
      const inputsResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const inputs = Array.from(document.querySelectorAll('input, textarea, [role="textbox"], [role="combobox"]'));
          return inputs.map((el, i) => ({
            index: i,
            tagName: el.tagName,
            type: el.type || el.getAttribute('role'),
            placeholder: el.placeholder,
            ariaLabel: el.getAttribute('aria-label'),
            id: el.id,
            className: el.className,
            value: el.value
          }));
        })()`,
        returnByValue: true
      });
      console.log("Input/Editable elements on page:");
      console.log(JSON.stringify(inputsResult.result.value, null, 2));

      // Take screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/create_group_dialog.png", buffer);
      console.log("Screenshot saved to create_group_dialog.png.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
