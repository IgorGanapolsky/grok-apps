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

      console.log("Clicking the Save button...");
      const clickSaveResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const saveBtn = buttons.find(b => b.textContent.trim() === 'Save');
          if (saveBtn) {
            saveBtn.click();
            return "SUCCESS: Clicked Save button";
          }
          return "ERROR: Save button not found";
        })()`,
        returnByValue: true
      });
      console.log("Save click status:", clickSaveResult.result.value);

      console.log("Waiting 6 seconds for the changes to save and page to update...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Let's capture a post-save screenshot
      await sendCommand("Page.enable");
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/testers_saved_success.png", buffer);
      console.log("Post-save screenshot saved.");

      // Check if there is any error or success message
      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText.substring(0, 2000)",
        returnByValue: true
      });
      console.log("Page snippet after save:", textResult.result.value.substring(0, 500));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
