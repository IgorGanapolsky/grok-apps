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

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current active URL: ${urlResult.result.value}`);

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- My Groups Page Content ---");
      const lines = pageText.split("\n");
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("---------------------------\n");

      // Inspect elements that look like buttons or links
      const buttonsResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'));
          return elements.map((el, i) => ({
            index: i,
            tagName: el.tagName,
            type: el.type || el.getAttribute('role'),
            text: el.innerText.trim(),
            id: el.id,
            className: el.className,
            ariaLabel: el.getAttribute('aria-label')
          })).filter(el => el.text || el.ariaLabel);
        })()`,
        returnByValue: true
      });
      console.log("Found buttons/links:");
      console.log(JSON.stringify(buttonsResult.result.value, null, 2));

      // Take screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/my_groups.png", buffer);
      console.log("Screenshot saved to my_groups.png.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
