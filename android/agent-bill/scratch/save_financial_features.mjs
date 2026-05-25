import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.url.includes("play.google.com/console") && t.url.includes("/app-content/finance"));
  if (!target) {
    console.error("ERROR: Not currently on the Financial features page.");
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

      console.log("Clicking the 'Save' button...");
      const clickSaveResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          // Find button that has text exact "Save"
          const saveButton = buttons.find(b => b.textContent.trim() === 'Save');
          if (saveButton) {
            const disabled = saveButton.disabled || saveButton.getAttribute('disabled') || saveButton.getAttribute('aria-disabled') === 'true';
            if (!disabled) {
              saveButton.click();
              return { clicked: true };
            } else {
              return { clicked: false, disabled: true };
            }
          }
          return { clicked: false, error: "Save button not found" };
        })()`,
        returnByValue: true
      });

      console.log("Save Click Result:", clickSaveResult.result.value);

      if (clickSaveResult.result.value.clicked) {
        console.log("Save clicked successfully. Waiting 8s for save transaction to complete...");
        await new Promise(resolve => setTimeout(resolve, 8000));

        const urlResult = await sendCommand("Runtime.evaluate", {
          expression: "window.location.href",
          returnByValue: true
        });
        console.log(`Current URL after Save: ${urlResult.result.value}`);

        const textResult = await sendCommand("Runtime.evaluate", {
          expression: "document.body.innerText",
          returnByValue: true
        });
        const pageText = textResult.result.value;

        console.log("\n--- Page Content after Save ---");
        const lines = pageText.split("\n");
        for (let i = 0; i < Math.min(lines.length, 50); i++) {
          console.log(`  > ${lines[i].trim()}`);
        }
        console.log("-------------------------------\n");

        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_after_save_text.txt", pageText);

        const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_after_save.png", Buffer.from(screenshotResult.data, "base64"));
        console.log("After-save screenshot saved.");
      }

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
