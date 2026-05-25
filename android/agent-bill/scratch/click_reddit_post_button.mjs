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

      console.log("Clicking the active Post button...");

      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const submitBtnContainer = document.querySelector('r-post-form-submit-button');
          if (submitBtnContainer && submitBtnContainer.shadowRoot) {
            const submitBtn = submitBtnContainer.shadowRoot.querySelector('button#inner-post-submit-button') || submitBtnContainer.shadowRoot.querySelector('button');
            if (submitBtn) {
              if (submitBtn.disabled) {
                return { success: false, error: "Button is still disabled!" };
              }
              submitBtn.click();
              return { success: true };
            }
            return { success: false, error: "Submit button inside shadowRoot not found" };
          }
          return { success: false, error: "r-post-form-submit-button container not found" };
        })()`,
        returnByValue: true
      });

      console.log("=== Click Result ===");
      console.log(JSON.stringify(clickResult.result.value, null, 2));

      if (clickResult.result.value && clickResult.result.value.success) {
        console.log("Post clicked successfully! Waiting 12 seconds for the post to submit and page to redirect...");
        await new Promise(resolve => setTimeout(resolve, 12000));

        const finalState = await sendCommand("Runtime.evaluate", {
          expression: `(() => {
            return {
              url: window.location.href,
              title: document.title,
              bodySnippet: document.body.innerText.substring(0, 1000)
            };
          })()`,
          returnByValue: true
        });

        console.log("=== Post-Submission Page State ===");
        console.log(JSON.stringify(finalState.result.value, null, 2));

        console.log("Capturing post submission verification screenshot...");
        const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
        const buffer = Buffer.from(screenshotResult.data, "base64");
        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/reddit_post_submitted.png", buffer);
        console.log("Screenshot saved.");
      } else {
        console.error("Could not click button. See above error.");
      }

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
