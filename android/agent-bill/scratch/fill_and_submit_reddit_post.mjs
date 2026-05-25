import { writeFileSync } from "node:fs";

async function run() {
  const targetId = "996582CD0A9FC776C043C47B4FE02DCE";
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

      console.log("Fills inputs...");

      const fillResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const results = {};

          // 1. Fill Title
          const titleContainer = document.querySelector('div#post-composer__title faceplate-textarea-input');
          if (titleContainer && titleContainer.shadowRoot) {
            const titleInput = titleContainer.shadowRoot.querySelector('textarea#innerTextArea') || titleContainer.shadowRoot.querySelector('textarea');
            if (titleInput) {
              titleInput.focus();
              titleInput.value = "[MUTUAL TEST] AgentBill — AI Cost Auditor (Will test back immediately!)";
              titleInput.dispatchEvent(new Event('input', { bubbles: true }));
              titleInput.dispatchEvent(new Event('change', { bubbles: true }));
              titleInput.blur();
              results.titleFilled = true;
            } else {
              results.titleFilled = "titleInput not found in shadowRoot";
            }
          } else {
            results.titleFilled = "titleContainer or shadowRoot not found";
          }

          // 2. Fill Body
          const bodyEl = document.querySelector('div[aria-label="Post body text field"]') || 
                         document.querySelector('div[aria-label="Optional Body text field"]') ||
                         document.querySelector('shreddit-composer[name="body"] div[contenteditable="true"]') ||
                         document.querySelector('shreddit-composer[name="optionalBody"] div[contenteditable="true"]');
                         
          if (bodyEl) {
            bodyEl.focus();
            const bodyContent = "Hey fellow developers! I need 12 closed testers for my app AgentBill — AI Cost Auditor. I will test yours back immediately!\\n\\n" +
              "1. Join the Google Group: https://groups.google.com/g/agentbill-testers\\n" +
              "2. Opt-in on the Web: https://play.google.com/apps/testing/com.iganapolsky.agentbill\\n" +
              "3. Download on Android: https://play.google.com/store/apps/details?id=com.iganapolsky.agentbill\\n\\n" +
              "Please leave a comment below with your Google Group/email and store links, and I will opt-in and download your app immediately. Let's help each other out!";
              
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, bodyContent);
            bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
            bodyEl.blur();
            results.bodyFilled = true;
          } else {
            results.bodyFilled = false;
          }

          // 3. Check Submit Button
          const submitBtnContainer = document.querySelector('r-post-form-submit-button');
          if (submitBtnContainer && submitBtnContainer.shadowRoot) {
            const submitBtn = submitBtnContainer.shadowRoot.querySelector('button#inner-post-submit-button') || submitBtnContainer.shadowRoot.querySelector('button');
            if (submitBtn) {
              results.submitBtnFound = true;
              results.submitBtnDisabled = submitBtn.disabled;
            } else {
              results.submitBtnFound = "submitBtn not found in shadowRoot";
            }
          } else {
            results.submitBtnFound = "submitBtnContainer or shadowRoot not found";
          }

          return results;
        })()`,
        returnByValue: true
      });

      console.log("=== Fill Result ===");
      console.log(JSON.stringify(fillResult.result.value, null, 2));

      // Wait 3 seconds for updates, then take screenshot
      console.log("Waiting 3 seconds...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/reddit_filled_perfect.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
