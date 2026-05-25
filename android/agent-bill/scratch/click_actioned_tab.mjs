import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.url.includes("play.google.com/console") && t.url.includes("/app-content/overview"));
  if (!target) {
    console.error("ERROR: Not currently on the App Content page.");
    process.exit(1);
  }

  console.log(`Connecting to: "${target.title}"`);
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

      console.log("Clicking the 'Actioned' tab...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          
          // Let's find button or tab that has text "Actioned"
          const actionedTab = elements.find(el => 
            el.textContent.trim() === 'Actioned' && 
            (el.tagName.toLowerCase() === 'div' || el.tagName.toLowerCase() === 'button' || el.tagName.toLowerCase() === 'span')
          );
          
          if (actionedTab) {
            actionedTab.click();
            return { clicked: true, tag: actionedTab.tagName, text: actionedTab.textContent.trim() };
          }
          
          return { clicked: false };
        })()`,
        returnByValue: true
      });

      console.log("Click result:", clickResult.result.value);

      console.log("Waiting 6s for the tab to load content...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const actionedText = textResult.result.value;

      console.log("\n--- Actioned Tab Page Content ---");
      const lines = actionedText.split("\n");
      for (const line of lines) {
        const l = line.trim();
        if (l.length > 0) {
          console.log(`  > ${l}`);
        }
      }
      console.log("---------------------------------\n");

      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/app_content_actioned_text.txt", actionedText);

      // Take a screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/app_content_actioned_state.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
