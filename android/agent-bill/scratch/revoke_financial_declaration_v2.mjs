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

      console.log("Clicking the MATERIAL-CHECKBOX elements...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const checkboxes = Array.from(document.querySelectorAll('material-checkbox'));
          const log = [];
          
          // Let's find 'Buy now, pay later' checkbox
          const bnplCB = checkboxes.find(cb => cb.textContent.trim().includes('Buy now, pay later'));
          if (bnplCB) {
            const input = bnplCB.querySelector('input');
            if (input && input.checked) {
              bnplCB.click();
              log.push("Clicked to UNCHECK 'Buy now, pay later'");
            } else {
              log.push("'Buy now, pay later' is already unchecked");
            }
          } else {
            log.push("ERROR: 'Buy now, pay later' checkbox not found");
          }

          // Let's find 'My app doesn't provide any financial features' checkbox
          const noneCB = checkboxes.find(cb => cb.textContent.trim().includes("My app doesn't provide any financial features"));
          if (noneCB) {
            const input = noneCB.querySelector('input');
            if (input && !input.checked) {
              noneCB.click();
              log.push("Clicked to CHECK 'My app doesn't provide any financial features'");
            } else {
              log.push("'My app doesn't provide any financial features' is already checked");
            }
          } else {
            log.push("ERROR: 'My app doesn't provide any financial features' checkbox not found");
          }

          // Re-check input state of all checkboxes to confirm
          const states = checkboxes.map(cb => {
            const input = cb.querySelector('input');
            return {
              text: cb.textContent.trim().slice(0, 40),
              checked: input ? input.checked : false
            };
          });

          return { success: true, log, states };
        })()`,
        returnByValue: true
      });

      console.log("Checkbox Toggling Result:\n", JSON.stringify(clickResult.result.value, null, 2));

      // Wait 2 seconds for state reflection
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Take intermediate screenshot
      let screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_selection_v2_modified.png", Buffer.from(screenshotResult.data, "base64"));
      console.log("Screenshot saved.");

      // Check Next button
      console.log("Checking and clicking Next button...");
      const nextClickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const nextButton = buttons.find(b => b.textContent.trim() === 'Next');
          if (nextButton) {
            const disabled = nextButton.disabled || nextButton.getAttribute('disabled');
            if (!disabled) {
              nextButton.click();
              return { clicked: true };
            } else {
              return { clicked: false, disabled: true, classes: nextButton.className };
            }
          }
          return { clicked: false, error: "Next button not found" };
        })()`,
        returnByValue: true
      });

      console.log("Next Click Result:", nextClickResult.result.value);

      if (nextClickResult.result.value.clicked) {
        console.log("Successfully clicked Next! Waiting 8s for step 2 (Documentation/Save) to load...");
        await new Promise(resolve => setTimeout(resolve, 8000));

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

        console.log("\n--- Page Content after Next (Step 2) ---");
        const lines = pageText.split("\n");
        for (let i = 0; i < Math.min(lines.length, 50); i++) {
          console.log(`  > ${lines[i].trim()}`);
        }
        console.log("----------------------------------------\n");

        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_step2_text.txt", pageText);

        screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_step2_state.png", Buffer.from(screenshotResult.data, "base64"));
        console.log("Step 2 screenshot saved.");
      }

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
