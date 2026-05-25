import { writeFileSync } from "node:fs";

async function run() {
  console.log("Connecting to Comet to open Google Groups via Target.createTarget...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find any active page to connect to
  const activePage = targets.find(t => t.type === "page" && t.webSocketDebuggerUrl);
  if (!activePage) {
    console.error("ERROR: No active page found to bootstrap CDP connection.");
    process.exit(1);
  }

  console.log(`Connecting to bootstrap target: "${activePage.title}"`);
  const ws = new WebSocket(activePage.webSocketDebuggerUrl);

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
      console.log("Creating new tab for Google Groups...");
      const result = await sendCommand("Target.createTarget", {
        url: "https://groups.google.com/my-groups"
      });
      console.log("Target created successfully:", result);
      
      const targetId = result.targetId;
      console.log(`Target ID: ${targetId}`);

      // Now fetch list of pages again to get the WebSocket URL of the new target
      console.log("Waiting 2s for target list to sync...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      const res2 = await fetch("http://127.0.0.1:9222/json/list");
      const targets2 = await res2.json();
      const newTab = targets2.find(t => t.webSocketDebuggerUrl && t.webSocketDebuggerUrl.includes(targetId));
      
      if (!newTab) {
        console.error("ERROR: Could not find the new target in /json/list.");
        ws.close();
        return;
      }

      console.log("Connecting to new tab...");
      const ws2 = new WebSocket(newTab.webSocketDebuggerUrl);
      
      const sendCommand2 = (method, params = {}) => {
        return new Promise((resolve, reject) => {
          const id = Math.floor(Math.random() * 1000000);
          const messageHandler = (event) => {
            const response = JSON.parse(event.data);
            if (response.id === id) {
              ws2.removeEventListener("message", messageHandler);
              if (response.error) {
                reject(response.error);
              } else {
                resolve(response.result);
              }
            }
          };
          ws2.addEventListener("message", messageHandler);
          ws2.send(JSON.stringify({ id, method, params }));
        });
      };

      ws2.onopen = async () => {
        try {
          await sendCommand2("Page.enable");
          await sendCommand2("Runtime.enable");

          console.log("Waiting 8s for Google Groups to load...");
          await new Promise(resolve => setTimeout(resolve, 8000));

          const urlResult = await sendCommand2("Runtime.evaluate", {
            expression: "window.location.href",
            returnByValue: true
          });
          console.log(`Active URL: ${urlResult.result.value}`);

          const textResult = await sendCommand2("Runtime.evaluate", {
            expression: "document.body.innerText",
            returnByValue: true
          });
          
          console.log("\n--- Google Groups Content ---");
          const lines = textResult.result.value.split("\n");
          for (let i = 0; i < Math.min(lines.length, 30); i++) {
            console.log(`  > ${lines[i].trim()}`);
          }
          console.log("-----------------------------\n");

          // Screenshot
          const screenshotResult = await sendCommand2("Page.captureScreenshot", { format: "png" });
          const buffer = Buffer.from(screenshotResult.data, "base64");
          writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/google_groups_status.png", buffer);
          console.log("Screenshot saved.");

        } catch (err) {
          console.error(err);
        } finally {
          ws2.close();
          ws.close();
          console.log("Connections closed.");
        }
      };

    } catch (err) {
      console.error(err);
      ws.close();
    }
  };
}

run().catch(console.error);
