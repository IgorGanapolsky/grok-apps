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

      console.log("Clicking 'Testers' tab...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const tabBtns = Array.from(document.querySelectorAll('tab-button, [role="tab"]'));
          const testersBtn = tabBtns.find(b => b.textContent.includes('Testers'));
          if (testersBtn) {
            testersBtn.click();
            return "SUCCESS: Clicked Testers tab";
          }
          return "ERROR: Testers tab button not found";
        })()`,
        returnByValue: true
      });
      console.log("Click status:", clickResult.result.value);

      console.log("Waiting 5s for the testers tab content to load...");
      await new Promise(resolve => setTimeout(resolve, 5000));

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- Testers Section Content ---");
      const lines = pageText.split("\n");
      // Find the index of "Testers" or "Mailing lists" to print relevant section
      const testersIndex = lines.findIndex(l => l.includes("Mailing lists") || l.includes("Select testers"));
      const startIndex = testersIndex !== -1 ? Math.max(0, testersIndex - 5) : 0;
      for (let i = startIndex; i < Math.min(lines.length, startIndex + 70); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("-------------------------------\n");

      // Save page text
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/testers_tab_text.txt", pageText);

      // Find inputs, checkboxes, buttons on this page
      const interactiveElements = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const els = Array.from(document.querySelectorAll('button, input, textarea, mat-checkbox, [role="button"], [role="checkbox"]'));
          return els.map((el, i) => ({
            index: i,
            tagName: el.tagName,
            type: el.type || el.getAttribute('role'),
            text: el.innerText ? el.innerText.trim() : '',
            id: el.id,
            className: el.className,
            ariaLabel: el.getAttribute('aria-label'),
            checked: el.checked || el.getAttribute('aria-checked')
          })).filter(el => el.text || el.ariaLabel || el.tagName === 'INPUT');
        })()`,
        returnByValue: true
      });
      console.log("Interactive elements in Testers tab:");
      console.log(JSON.stringify(interactiveElements.result.value, null, 2));

      // Take screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/testers_tab_page.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
