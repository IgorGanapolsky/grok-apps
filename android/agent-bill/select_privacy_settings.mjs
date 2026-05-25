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

      console.log("Setting privacy options (Anyone on the web can search, Anyone can join)...");
      const setOptionsResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // 1. Click "Anyone on the web" (under Who can search)
          const options = Array.from(document.querySelectorAll('[role="option"]'));
          
          // Let's find "Anyone on the web"
          const anyoneWebOption = options.find(el => {
            const txt = el.innerText ? el.innerText.trim() : '';
            return txt === 'Anyone on the web';
          });
          if (anyoneWebOption) {
            anyoneWebOption.click();
            console.log("Clicked Anyone on the web");
          } else {
            console.log("Could not find 'Anyone on the web' option");
          }

          // 2. Click "Anyone can join" (under Who can join)
          const anyoneJoinOption = options.find(el => {
            const txt = el.innerText ? el.innerText.trim() : '';
            return txt === 'Anyone can join';
          });
          if (anyoneJoinOption) {
            anyoneJoinOption.click();
            console.log("Clicked Anyone can join");
          } else {
            console.log("Could not find 'Anyone can join' option");
          }

          return "SUCCESS: Options clicked";
        })()`,
        returnByValue: true
      });
      console.log(setOptionsResult.result.value);

      // Wait 1.5s
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log("Clicking Next button on Step 2...");
      const clickNextResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('[role="button"]'));
          const nextBtn = buttons.find(el => {
            const hasNextText = el.innerText && el.innerText.trim() === 'Next';
            const isVisible = el.offsetParent !== null;
            const isNotDisabled = !el.getAttribute('aria-disabled') || el.getAttribute('aria-disabled') === 'false';
            return hasNextText && isVisible && isNotDisabled;
          });

          if (nextBtn) {
            nextBtn.click();
            return "SUCCESS: Clicked Next button on Step 2";
          }
          return "ERROR: Next button not found on Step 2";
        })()`,
        returnByValue: true
      });
      console.log("Click result:", clickNextResult.result.value);

      console.log("Waiting 3s for Step 3 to load...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      console.log("\n--- Step 3 Page Content ---");
      const lines = textResult.result.value.split("\n");
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("---------------------------\n");

      // Dump all input/interactive elements of Step 3
      const step3Elements = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const elements = Array.from(document.querySelectorAll('button, input, textarea, [role="button"], [role="checkbox"]'));
          return elements.map((el, i) => ({
            index: i,
            tagName: el.tagName,
            type: el.type || el.getAttribute('role'),
            text: el.innerText ? el.innerText.trim() : '',
            ariaLabel: el.getAttribute('aria-label'),
            className: el.className
          })).filter(el => el.text || el.ariaLabel || el.tagName === 'INPUT');
        })()`,
        returnByValue: true
      });
      console.log("Step 3 interactive elements:");
      console.log(JSON.stringify(step3Elements.result.value, null, 2));

      // Take screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/create_group_step3.png", buffer);
      console.log("Screenshot saved to create_group_step3.png.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
