import { writeFileSync } from "node:fs";

async function run() {
  console.log("Connecting to Comet to open create-group page...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find any active page to connect to
  const activePage = targets.find(t => t.type === "page" && t.webSocketDebuggerUrl);
  if (!activePage) {
    console.error("ERROR: No active page found.");
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
      console.log("Creating new tab for groups creation...");
      const result = await sendCommand("Target.createTarget", {
        url: "https://groups.google.com/create-group"
      });
      const targetId = result.targetId;
      console.log(`Created target ID: ${targetId}`);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const res2 = await fetch("http://127.0.0.1:9222/json/list");
      const targets2 = await res2.json();
      const groupTab = targets2.find(t => t.webSocketDebuggerUrl && t.webSocketDebuggerUrl.includes(targetId));
      
      if (!groupTab) {
        console.error("ERROR: Could not find new target.");
        ws.close();
        return;
      }

      console.log("Connecting to Group Creation tab...");
      const ws2 = new WebSocket(groupTab.webSocketDebuggerUrl);
      
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

          console.log("Waiting 8s for create-group page to load...");
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
          
          console.log("\n--- Create Group Content ---");
          const lines = textResult.result.value.split("\n");
          for (let i = 0; i < Math.min(lines.length, 35); i++) {
            console.log(`  > ${lines[i].trim()}`);
          }
          console.log("----------------------------\n");

          // Let's get input fields info
          const inputResult = await sendCommand2("Runtime.evaluate", {
            expression: `(() => {
              const inputs = Array.from(document.querySelectorAll('input, textarea'));
              return inputs.map((el, i) => ({
                index: i,
                tagName: el.tagName,
                type: el.type,
                placeholder: el.placeholder,
                ariaLabel: el.getAttribute('aria-label'),
                id: el.id,
                value: el.value
              }));
            })()`,
            returnByValue: true
          });
          console.log("Input elements on page:", inputResult.result.value);

          // Screenshot
          const screenshotResult = await sendCommand2("Page.captureScreenshot", { format: "png" });
          const buffer = Buffer.from(screenshotResult.data, "base64");
          writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/create_group_page.png", buffer);
          console.log("Screenshot saved to create_group_page.png");

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
