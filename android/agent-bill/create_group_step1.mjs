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

      console.log("Filling Step 1 fields...");
      const fillResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const nameInput = document.querySelector('input[aria-label="Group name"]');
          const emailInput = document.querySelector('input[aria-label="Group email prefix"]');
          const descInput = document.querySelector('textarea[aria-label="Group description"]');

          if (!nameInput || !emailInput || !descInput) {
            return "ERROR: Step 1 fields not found";
          }

          // Set values
          nameInput.value = "AgentBill Closed Testing";
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));

          emailInput.value = "agentbill-testers";
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));

          descInput.value = "Closed testing group for AgentBill — AI Cost Auditor. Anyone can join this group to participate as an external closed tester.";
          descInput.dispatchEvent(new Event('input', { bubbles: true }));
          descInput.dispatchEvent(new Event('change', { bubbles: true }));

          return "SUCCESS: Step 1 fields filled";
        })()`,
        returnByValue: true
      });
      console.log("Fill status:", fillResult.result.value);

      // Brief wait before clicking Next
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log("Clicking Next...");
      const nextResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const nextBtn = btns.find(btn => btn.innerText.trim() === 'Next');
          if (nextBtn) {
            nextBtn.click();
            return "SUCCESS: Next clicked";
          }
          return "ERROR: Next button not found";
        })()`,
        returnByValue: true
      });
      console.log("Next click status:", nextResult.result.value);

      console.log("Waiting 4s for Step 2 (Privacy settings) to load...");
      await new Promise(resolve => setTimeout(resolve, 4000));

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      console.log("\n--- Step 2 Page Content ---");
      const lines = textResult.result.value.split("\n");
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("---------------------------\n");

      // Inspect elements that look like checkboxes, switches, select dropdowns
      const formInspectResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const elements = Array.from(document.querySelectorAll('button, input, textarea, [role="checkbox"], [role="radio"], [role="combobox"], [role="listbox"]'));
          return elements.map((el, i) => ({
            index: i,
            tagName: el.tagName,
            type: el.type || el.getAttribute('role'),
            text: el.innerText ? el.innerText.trim() : '',
            id: el.id,
            className: el.className,
            ariaLabel: el.getAttribute('aria-label'),
            value: el.value
          })).filter(el => el.text || el.ariaLabel || el.tagName === 'INPUT');
        })()`,
        returnByValue: true
      });
      console.log("Interactive elements on Step 2:");
      console.log(JSON.stringify(formInspectResult.result.value, null, 2));

      // Take screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/create_group_step2.png", buffer);
      console.log("Screenshot saved to create_group_step2.png.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
