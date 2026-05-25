import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  const target = targets.find(t => t.url.includes("play.google.com/console"));
  if (!target) {
    console.error("ERROR: No active Play Console tab found.");
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

      // Click "Send 12 changes for review"
      console.log("Clicking 'Send 12 changes for review'...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const btn = document.querySelector('button[debug-id="send-for-review-button"]');
          if (btn) {
            btn.click();
            return { clicked: true, text: btn.textContent.trim() };
          }
          
          // Fallback search by text
          const btns = Array.from(document.querySelectorAll('button'));
          const fallbackBtn = btns.find(b => b.textContent.includes('Send') && b.textContent.includes('changes') && b.textContent.includes('review'));
          if (fallbackBtn) {
            fallbackBtn.click();
            return { clicked: true, text: fallbackBtn.textContent.trim(), fallback: true };
          }
          
          return { clicked: false };
        })()`,
        returnByValue: true
      });

      console.log("Click primary button result:", clickResult.result.value);

      console.log("Waiting 5s for confirmation modal...");
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Click the Confirm/Send button in the confirmation modal
      console.log("Looking for and clicking confirm button in confirmation modal...");
      const confirmResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          
          // In Google Play Console, the confirmation dialog has buttons. Let's find one that is in a modal or contains Send/review
          // Let's print out all candidate button text to see
          const candidates = buttons.map(b => b.textContent.trim());
          
          // Look for 'Send changes for review' inside dialog/modal (usually has yes-button class or unelevated)
          const confirmBtn = buttons.find(b => 
            b.textContent.trim() === 'Send changes for review' && 
            (b.className.includes('yes') || b.className.includes('unelevated') || b.parentElement?.parentElement?.className?.includes('modal') || b.parentElement?.parentElement?.className?.includes('dialog'))
          );
          
          if (confirmBtn) {
            confirmBtn.click();
            return { clicked: true, text: confirmBtn.textContent.trim(), candidates };
          }
          
          // Alternate match: last button with Send changes for review
          const lastBtn = buttons.filter(b => b.textContent.trim() === 'Send changes for review').pop();
          if (lastBtn) {
            lastBtn.click();
            return { clicked: true, method: 'lastBtn', text: lastBtn.textContent.trim(), candidates };
          }
          
          // Fallback match: button containing "Send" or "Confirm"
          const sendBtn = buttons.find(b => b.textContent.includes('Send') && b !== document.querySelector('button[debug-id="send-for-review-button"]'));
          if (sendBtn) {
            sendBtn.click();
            return { clicked: true, method: 'sendBtn', text: sendBtn.textContent.trim(), candidates };
          }
          
          return { clicked: false, candidates };
        })()`,
        returnByValue: true
      });
      console.log("Click confirm result:", confirmResult.result.value);

      console.log("Waiting 8s for submission to complete...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL: ${urlResult.result.value}`);

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- Page Content after Re-submission ---");
      const lines = pageText.split("\n");
      for (let i = 0; i < Math.min(lines.length, 35); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("----------------------------------------\n");

      // Save page text
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/re_submission_result_text.txt", pageText);

      // Capture screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/re_submission_success.png", buffer);
      console.log("Final screenshot saved to re_submission_success.png.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
