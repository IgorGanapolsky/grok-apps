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

  async function typeString(text) {
    for (const char of text) {
      if (char === "\n") {
        await sendCommand("Input.dispatchKeyEvent", {
          type: "keyDown",
          windowsVirtualKeyCode: 13,
          key: "Enter",
          code: "Enter"
        });
        await sendCommand("Input.dispatchKeyEvent", {
          type: "keyUp",
          windowsVirtualKeyCode: 13,
          key: "Enter",
          code: "Enter"
        });
      } else {
        await sendCommand("Input.dispatchKeyEvent", {
          type: "keyDown",
          text: char,
          unmodifiedText: char,
          key: char
        });
        await sendCommand("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: char
        });
      }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  ws.onopen = async () => {
    try {
      await sendCommand("Runtime.enable");
      await sendCommand("Page.enable");

      console.log("1. Clear existing inputs...");
      await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const titleContainer = document.querySelector('div#post-composer__title faceplate-textarea-input');
          if (titleContainer && titleContainer.shadowRoot) {
            const titleInput = titleContainer.shadowRoot.querySelector('textarea#innerTextArea') || titleContainer.shadowRoot.querySelector('textarea');
            if (titleInput) {
              titleInput.value = '';
              titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }

          const bodyEl = document.querySelector('div[aria-label="Post body text field"]') || 
                         document.querySelector('div[aria-label="Optional Body text field"]') ||
                         document.querySelector('shreddit-composer[name="body"] div[contenteditable="true"]') ||
                         document.querySelector('shreddit-composer[name="optionalBody"] div[contenteditable="true"]');
          if (bodyEl) {
            bodyEl.innerHTML = '';
            bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()`
      });

      console.log("2. Focus and type Title via CDP...");
      await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const titleContainer = document.querySelector('div#post-composer__title faceplate-textarea-input');
          if (titleContainer && titleContainer.shadowRoot) {
            const titleInput = titleContainer.shadowRoot.querySelector('textarea#innerTextArea') || titleContainer.shadowRoot.querySelector('textarea');
            if (titleInput) {
              titleInput.focus();
              return true;
            }
          }
          return false;
        })()`
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      await typeString("[MUTUAL TEST] AgentBill — AI Cost Auditor (Will test back immediately!)");

      console.log("3. Focus and type Body via CDP...");
      await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const bodyEl = document.querySelector('div[aria-label="Post body text field"]') || 
                         document.querySelector('div[aria-label="Optional Body text field"]') ||
                         document.querySelector('shreddit-composer[name="body"] div[contenteditable="true"]') ||
                         document.querySelector('shreddit-composer[name="optionalBody"] div[contenteditable="true"]');
          if (bodyEl) {
            bodyEl.focus();
            return true;
          }
          return false;
        })()`
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      const bodyText = "Hey fellow developers! I need 12 closed testers for my app AgentBill — AI Cost Auditor. I will test yours back immediately!\n\n" +
        "1. Join the Google Group: https://groups.google.com/g/agentbill-testers\n" +
        "2. Opt-in on the Web: https://play.google.com/apps/testing/com.iganapolsky.agentbill\n" +
        "3. Download on Android: https://play.google.com/store/apps/details?id=com.iganapolsky.agentbill\n\n" +
        "Please leave a comment below with your Google Group/email and store links, and I will opt-in and download your app immediately. Let's help each other out!";
      await typeString(bodyText);

      // Verify submit button status
      const btnStatus = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const submitBtnContainer = document.querySelector('r-post-form-submit-button');
          if (submitBtnContainer && submitBtnContainer.shadowRoot) {
            const submitBtn = submitBtnContainer.shadowRoot.querySelector('button#inner-post-submit-button') || submitBtnContainer.shadowRoot.querySelector('button');
            if (submitBtn) {
              return {
                found: true,
                disabled: submitBtn.disabled
              };
            }
          }
          return { found: false };
        })()`,
        returnByValue: true
      });

      console.log("=== Submit Button Status ===");
      console.log(JSON.stringify(btnStatus.result.value, null, 2));

      console.log("Taking validation screenshot...");
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/reddit_typed_cdp.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
