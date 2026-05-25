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

      console.log("Clicking checkboxes by label elements...");
      const clickLabelsResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const log = [];

          // Find the exact text labels or their closest parent checkbox wrapper
          // Typically we want to click the text/label container.
          
          // Let's find "Buy now, pay later"
          const bnplEl = elements.find(el => el.textContent.trim() === 'Buy now, pay later');
          // Let's find "My app doesn't provide any financial features"
          const noneEl = elements.find(el => el.textContent.trim() === "My app doesn't provide any financial features");

          if (bnplEl) {
            // Find parent label or container that handles click
            let clickTarget = bnplEl;
            while (clickTarget && clickTarget.tagName.toLowerCase() !== 'label' && clickTarget.tagName.toLowerCase() !== 'mat-checkbox' && clickTarget.tagName.toLowerCase() !== 'mdc-checkbox') {
              if (clickTarget.parentElement) clickTarget = clickTarget.parentElement;
              else break;
            }
            clickTarget.click();
            log.push("Clicked 'Buy now, pay later' container: " + clickTarget.tagName);
          } else {
            log.push("ERROR: 'Buy now, pay later' element not found");
          }

          if (noneEl) {
            let clickTarget = noneEl;
            while (clickTarget && clickTarget.tagName.toLowerCase() !== 'label' && clickTarget.tagName.toLowerCase() !== 'mat-checkbox' && clickTarget.tagName.toLowerCase() !== 'mdc-checkbox') {
              if (clickTarget.parentElement) clickTarget = clickTarget.parentElement;
              else break;
            }
            clickTarget.click();
            log.push("Clicked 'My app doesn't provide any financial features' container: " + clickTarget.tagName);
          } else {
            log.push("ERROR: 'My app doesn't provide any financial features' element not found");
          }

          // Let's check the Next button status now
          const buttons = Array.from(document.querySelectorAll('button'));
          const nextButton = buttons.find(b => b.textContent.trim() === 'Next');
          const isNextDisabled = nextButton ? (nextButton.disabled || nextButton.getAttribute('disabled')) : "not found";

          return { success: true, log, isNextDisabled };
        })()`,
        returnByValue: true
      });

      console.log("Click Labels Result:", clickLabelsResult.result.value);

      // Save screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/checkbox_clicked_result.png", Buffer.from(screenshotResult.data, "base64"));
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
