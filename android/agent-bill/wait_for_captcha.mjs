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
      await sendCommand("Runtime.enable");

      console.log("Starting polling for Captcha completion. I will check every 3s for up to 3 minutes...");
      
      const startTime = Date.now();
      const timeout = 300000; // 5 minutes
      let success = false;

      while (Date.now() - startTime < timeout) {
        // 1. Check URL first to see if group was already created and navigated
        const urlResult = await sendCommand("Runtime.evaluate", {
          expression: "window.location.href",
          returnByValue: true
        });
        const currentUrl = urlResult.result.value;
        console.log(`[${new Date().toLocaleTimeString()}] Current URL: ${currentUrl}`);

        if (currentUrl.includes("/g/agentbill-testers") || currentUrl.includes("/g/agentbill-closed-testing")) {
          console.log("SUCCESS: Navigated to newly created Google Group! Group is successfully created.");
          success = true;
          break;
        }

        // 2. Check if Captcha response is filled
        const captchaResult = await sendCommand("Runtime.evaluate", {
          expression: `(() => {
            const textarea = document.getElementById('g-recaptcha-response') || document.querySelector('.g-recaptcha-response');
            const hasCaptchaResponse = textarea && textarea.value && textarea.value.length > 0;
            
            // Also check if Captcha element exists
            const text = document.body.innerText;
            const hasCaptchaText = text.includes('Captcha required');
            
            return { hasCaptchaResponse, hasCaptchaText };
          })()`,
          returnByValue: true
        });

        const { hasCaptchaResponse, hasCaptchaText } = captchaResult.result.value;
        console.log(`    > CaptchaText present: ${hasCaptchaText}, CaptchaResponse filled: ${hasCaptchaResponse}`);

        if (hasCaptchaResponse && hasCaptchaText) {
          console.log("Captcha response detected! Attempting to click 'Create group' again...");
          const clickResult = await sendCommand("Runtime.evaluate", {
            expression: `(() => {
              const buttons = Array.from(document.querySelectorAll('[role="button"]'));
              const createBtn = buttons.find(el => {
                const hasText = el.innerText && el.innerText.trim() === 'Create group';
                const isVisible = el.offsetParent !== null;
                return hasText && isVisible;
              });
              if (createBtn) {
                createBtn.click();
                return "SUCCESS: Clicked Create group after Captcha response";
              }
              return "ERROR: Create group button not found";
            })()`,
            returnByValue: true
          });
          console.log(`    > Click status: ${clickResult.result.value}`);
        }

        // Take a screenshot to visualize
        const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
        const buffer = Buffer.from(screenshotResult.data, "base64");
        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/create_group_polling_state.png", buffer);

        // Wait 3 seconds
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      if (!success) {
        console.log("Polling timed out after 3 minutes.");
      }

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("Connection closed.");
    }
  };
}

run().catch(console.error);
