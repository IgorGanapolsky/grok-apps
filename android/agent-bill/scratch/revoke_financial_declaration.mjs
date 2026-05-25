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

      console.log("Modifying questionnaire selections...");
      const selectResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
          const results = [];

          // Index 10 is 'Buy now, pay later'. If checked, click it to uncheck.
          if (inputs[10] && inputs[10].checked) {
            inputs[10].click();
            results.push("Unchecked 'Buy now, pay later'");
          } else {
            results.push("'Buy now, pay later' is already unchecked");
          }

          // Index 21 is 'My app doesn't provide any financial features'. If unchecked, click it.
          if (inputs[21] && !inputs[21].checked) {
            inputs[21].click();
            results.push("Checked 'My app doesn't provide any financial features'");
          } else {
            results.push("'My app doesn't provide any financial features' is already checked");
          }

          return { success: true, steps: results };
        })()`,
        returnByValue: true
      });

      console.log("Selection modify steps:", selectResult.result.value);

      // Take intermediate screenshot
      let screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_selection_modified.png", Buffer.from(screenshotResult.data, "base64"));
      console.log("Screenshot after selections saved.");

      // Click Next
      console.log("Clicking the 'Next' button...");
      const clickNextResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          // Find button that has text "Next"
          const nextButton = buttons.find(b => b.textContent.trim() === 'Next' && !b.disabled);
          if (nextButton) {
            nextButton.click();
            return { clicked: true };
          }
          return { clicked: false, error: "Next button not found or disabled" };
        })()`,
        returnByValue: true
      });

      console.log("Next click result:", clickNextResult.result.value);

      console.log("Waiting 6s for the next step to load...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL after Next: ${urlResult.result.value}`);

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- Page Content after Next ---");
      const lines = pageText.split("\n");
      for (let i = 0; i < Math.min(lines.length, 50); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("-------------------------------\n");

      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_next_page.txt", pageText);

      screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_next_state.png", Buffer.from(screenshotResult.data, "base64"));
      console.log("Final screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
