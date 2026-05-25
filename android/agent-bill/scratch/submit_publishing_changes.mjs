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
      await sendCommand("Page.enable");

      console.log("Waiting for Publishing overview page to finish loading...");
      let loaded = false;
      for (let attempt = 1; attempt <= 12; attempt++) {
        const checkResult = await sendCommand("Runtime.evaluate", {
          expression: `(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const sendBtn = btns.find(b => b.textContent.includes('Send') && b.textContent.includes('review'));
            const spinner = document.querySelector('circle, mdc-circular-progress, svg.spinner');
            return {
              hasSendButton: !!sendBtn,
              sendButtonText: sendBtn ? sendBtn.textContent.trim() : null,
              sendButtonDisabled: sendBtn ? (sendBtn.disabled || sendBtn.getAttribute('disabled') !== null) : null,
              hasSpinner: !!spinner
            };
          })()`,
          returnByValue: true
        });

        console.log(`Attempt ${attempt}:`, checkResult.result.value);
        if (checkResult.result.value.hasSendButton && !checkResult.result.value.hasSpinner) {
          loaded = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      if (!loaded) {
        console.log("Warning: Page did not load completely or Send button was not found. Capturing current state...");
      }

      // Perform click on "Send for review" primary button
      console.log("Attempting to click primary 'Send changes for review' button...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const btn = document.querySelector('button[debug-id="send-for-review-button"]');
          if (btn) {
            btn.click();
            return { clicked: true, text: btn.textContent.trim() };
          }
          
          // Fallback
          const btns = Array.from(document.querySelectorAll('button'));
          const fallbackBtn = btns.find(b => b.textContent.includes('Send') && b.textContent.includes('changes') && b.textContent.includes('review'));
          if (fallbackBtn) {
            fallbackBtn.click();
            return { clicked: true, text: fallbackBtn.textContent.trim(), fallback: true };
          }
          
          return { clicked: false, buttons: btns.map(b => b.textContent.trim()) };
        })()`,
        returnByValue: true
      });
      console.log("Click result:", clickResult.result.value);

      if (clickResult.result.value.clicked) {
        console.log("Waiting 5s for confirmation modal...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Click confirm in the confirmation modal
        console.log("Clicking confirm inside the modal...");
        const confirmResult = await sendCommand("Runtime.evaluate", {
          expression: `(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const candidates = buttons.map(b => b.textContent.trim());
            
            // In Play Console modal, look for the 'Send changes for review' button
            const confirmBtn = buttons.find(b => 
              b.textContent.trim() === 'Send changes for review' && 
              b !== document.querySelector('button[debug-id="send-for-review-button"]')
            );
            
            if (confirmBtn) {
              confirmBtn.click();
              return { clicked: true, text: confirmBtn.textContent.trim() };
            }

            // Alternate confirm button
            const lastBtn = buttons.filter(b => b.textContent.trim() === 'Send changes for review').pop();
            if (lastBtn) {
              lastBtn.click();
              return { clicked: true, method: 'lastBtn', text: lastBtn.textContent.trim() };
            }
            
            return { clicked: false, candidates };
          })()`,
          returnByValue: true
        });
        console.log("Confirm click result:", confirmResult.result.value);

        console.log("Waiting 8 seconds for submission to complete...");
        await new Promise(resolve => setTimeout(resolve, 8000));
      }

      // Capture final screenshot and text
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/publishing_submitted_success.png", buffer);
      console.log("Screenshot saved to publishing_submitted_success.png.");

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/publishing_submitted_text.txt", textResult.result.value);
      console.log("Page text saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
