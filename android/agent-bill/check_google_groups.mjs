import { writeFileSync } from "node:fs";

async function run() {
  console.log("Checking Google Groups status...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Create a new tab
  console.log("Creating new tab for Google Groups...");
  const createRes = await fetch("http://127.0.0.1:9222/json/new?url=https://groups.google.com/my-groups");
  const newPage = await createRes.json();
  const wsUrl = newPage.webSocketDebuggerUrl;

  console.log(`Connecting to WebSocket: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

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

      console.log("Waiting 8s for Google Groups to load...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Active URL: ${urlResult.result.value}`);

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      
      console.log("\n--- Google Groups Content ---");
      const lines = textResult.result.value.split("\n");
      for (let i = 0; i < Math.min(lines.length, 30); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("-----------------------------\n");

      // Screenshot to verify
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/google_groups_status.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("Connection closed.");
    }
  };
}

run().catch(console.error);
