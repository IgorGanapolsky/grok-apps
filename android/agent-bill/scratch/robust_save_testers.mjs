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

      console.log("Starting robust Google Groups & Feedback configuration...");

      const evalResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const logs = [];
          
          // 1. Select Google Groups radio button
          const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
          if (radios.length >= 2) {
            radios[1].click();
            logs.push("Clicked Google Groups radio button");
          } else {
            logs.push("ERROR: Google Groups radio button not found");
          }

          return { success: true, logs };
        })()`,
        returnByValue: true
      });
      console.log("Step 1 (Radio):", evalResult.result.value);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const fillResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const logs = [];
          
          // 2. Fill the Group Email input and force chip creation
          const groupInput = document.querySelector('input[aria-label="Enter Google Group email addresses"]') || 
                             document.querySelector('.search-input');
                             
          if (!groupInput) {
            return { success: false, error: "Google Group input not found" };
          }
          
          groupInput.focus();
          // Clear any current text
          groupInput.value = "";
          groupInput.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Type value
          groupInput.value = "agentbill-testers@googlegroups.com";
          groupInput.dispatchEvent(new Event('input', { bubbles: true }));
          groupInput.dispatchEvent(new Event('change', { bubbles: true }));
          logs.push("Filled Google Group input text");

          // Try dispatching Enter, Tab, Comma, Semicolon events to force chipping
          const keysToTry = [
            { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 },
            { key: ',', code: 'Comma', keyCode: 188, which: 188 },
            { key: ' ', code: 'Space', keyCode: 32, which: 32 },
            { key: 'Tab', code: 'Tab', keyCode: 9, which: 9 }
          ];

          for (const k of keysToTry) {
            const down = new KeyboardEvent('keydown', { ...k, bubbles: true });
            const press = new KeyboardEvent('keypress', { ...k, bubbles: true });
            const up = new KeyboardEvent('keyup', { ...k, bubbles: true });
            groupInput.dispatchEvent(down);
            groupInput.dispatchEvent(press);
            groupInput.dispatchEvent(up);
            logs.push("Dispatched events for key: " + k.key);
          }

          // Let's also try to append a comma to the input value and fire input event
          groupInput.value = "agentbill-testers@googlegroups.com,";
          groupInput.dispatchEvent(new Event('input', { bubbles: true }));
          groupInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          // Fire blur event
          groupInput.dispatchEvent(new Event('blur', { bubbles: true }));
          logs.push("Appended comma, dispatched blur event");

          return { success: true, logs };
        })()`,
        returnByValue: true
      });
      console.log("Step 2 (Group Email):", fillResult.result.value);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const feedbackResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const logs = [];
          
          // 3. Find Feedback URL input robustly
          // We know the label parent contains "Let testers know how to provide you with feedback"
          const allInputs = Array.from(document.querySelectorAll('input, textarea'));
          let feedbackInput = null;
          
          for (const input of allInputs) {
            let p = input.parentElement;
            let parentText = "";
            for (let i = 0; i < 4 && p; i++) {
              if (p.innerText && p.innerText.trim()) {
                parentText = p.innerText.trim();
                break;
              }
              p = p.parentElement;
            }
            if (parentText.includes("Let testers know how to provide you with feedback") || parentText.includes("Feedback URL")) {
              feedbackInput = input;
              break;
            }
          }

          if (!feedbackInput) {
            // Fallback to index 3 which we saw from inspection
            if (allInputs.length > 3) {
              feedbackInput = allInputs[3];
              logs.push("Fallback: selected input at index 3 for feedback");
            }
          }

          if (feedbackInput) {
            feedbackInput.focus();
            feedbackInput.value = "https://groups.google.com/g/agentbill-testers";
            feedbackInput.dispatchEvent(new Event('input', { bubbles: true }));
            feedbackInput.dispatchEvent(new Event('change', { bubbles: true }));
            feedbackInput.dispatchEvent(new Event('blur', { bubbles: true }));
            logs.push("Successfully filled Feedback URL input");
          } else {
            return { success: false, error: "Feedback input not found" };
          }

          return { success: true, logs };
        })()`,
        returnByValue: true
      });
      console.log("Step 3 (Feedback URL):", feedbackResult.result.value);

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check form and button states
      const stateResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const chips = Array.from(document.querySelectorAll('span, div, button')).filter(el => {
            const txt = el.innerText ? el.innerText.trim() : '';
            return txt.includes('agentbill-testers');
          }).map(el => ({ tagName: el.tagName, className: el.className, text: el.innerText }));

          const buttons = Array.from(document.querySelectorAll('button'));
          const saveBtn = buttons.find(b => b.textContent.trim() === 'Save');
          
          const groupInput = document.querySelector('input[aria-label="Enter Google Group email addresses"]') || 
                             document.querySelector('.search-input');

          return {
            chips,
            inputValue: groupInput ? groupInput.value : null,
            saveBtnHTML: saveBtn ? saveBtn.outerHTML : null,
            saveBtnDisabled: saveBtn ? (saveBtn.disabled || saveBtn.getAttribute('disabled') !== null) : null
          };
        })()`,
        returnByValue: true
      });
      console.log("Step 4 (Form state):", JSON.stringify(stateResult.result.value, null, 2));

      // Let's capture a screenshot to inspect
      await sendCommand("Page.enable");
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/robust_testers_attempt.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
