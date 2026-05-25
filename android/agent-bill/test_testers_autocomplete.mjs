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

      console.log("Selecting 'Google Groups' radio button...");
      await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
          if (radios.length >= 2) {
            radios[1].click();
          }
        })()`
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log("Typing Google Group email address and pressing Enter...");
      const autocompleteResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const input = document.querySelector('input[aria-label="Enter Google Group email addresses"]') || 
                        document.querySelector('.search-input') ||
                        document.querySelector('input[placeholder*="Google Group"]');

          if (!input) {
            return "ERROR: Could not find Google Group input";
          }

          input.focus();
          input.value = "agentbill-testers@googlegroups.com";
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));

          // Press Enter key via custom events
          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
          const enterUp = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
          input.dispatchEvent(enterDown);
          input.dispatchEvent(enterUp);

          return "SUCCESS: Focused, filled and sent Enter event";
        })()`,
        returnByValue: true
      });
      console.log("Autocomplete event status:", autocompleteResult.result.value);

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log("Inspecting suggestions or chips on the page...");
      const inspectDOMResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const allElements = Array.from(document.querySelectorAll('*'));
          
          // Let's search for suggestion items or chipped text
          const suggestionItems = allElements.filter(el => {
            const txt = el.innerText ? el.innerText.trim() : '';
            return txt.includes('agentbill-testers') || txt.includes('googlegroups.com');
          }).map(el => ({
            tagName: el.tagName,
            className: el.className,
            text: el.innerText ? el.innerText.trim() : ''
          }));

          return { suggestionItems: suggestionItems.slice(0, 30) };
        })()`,
        returnByValue: true
      });
      console.log("Chipped/Suggestions elements:");
      console.log(JSON.stringify(inspectDOMResult.result.value, null, 2));

      // Let's see if there is any suggestion element we can click
      const clickSuggestionResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Look for element with role="option" or class containing "suggestion" or "dropdown" or simple span containing the email
          const elements = Array.from(document.querySelectorAll('*'));
          const suggestion = elements.find(el => {
            const txt = el.innerText ? el.innerText.trim() : '';
            const isClickable = el.className && (el.className.includes('suggestion') || el.className.includes('option') || el.className.includes('active'));
            return txt === 'agentbill-testers@googlegroups.com' || (txt.includes('agentbill-testers') && isClickable);
          });

          if (suggestion) {
            suggestion.click();
            return "SUCCESS: Clicked autocomplete suggestion";
          }
          return "NO_SUGGESTION_CLICKED";
        })()`,
        returnByValue: true
      });
      console.log("Click suggestion status:", clickSuggestionResult.result.value);

      // Fill feedback URL
      console.log("Filling feedback URL...");
      await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const feedbackInput = document.querySelector('input[aria-label="Feedback URL or email address"]') ||
                              document.querySelector('input[placeholder*="Feedback"]');
          if (feedbackInput) {
            feedbackInput.value = "https://groups.google.com/g/agentbill-testers";
            feedbackInput.dispatchEvent(new Event('input', { bubbles: true }));
            feedbackInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        })()`
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try Save
      console.log("Clicking Save...");
      const saveResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const saveBtn = buttons.find(b => b.textContent.trim() === 'Save');
          if (saveBtn) {
            saveBtn.click();
            return "SUCCESS: Clicked Save button";
          }
          return "ERROR: Save button not found";
        })()`,
        returnByValue: true
      });
      console.log("Save status:", saveResult.result.value);

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Capture screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/testers_autocomplete_attempt.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
