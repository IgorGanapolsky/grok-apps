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

      const infoResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Let's find all inputs and textareas and elements near them
          const inputs = Array.from(document.querySelectorAll('input, textarea'));
          const inputDetails = inputs.map((input, idx) => {
            // Find parent label or text around
            let parentText = "";
            let p = input.parentElement;
            for (let i = 0; i < 4 && p; i++) {
              if (p.innerText && p.innerText.trim()) {
                parentText = p.innerText.trim().substring(0, 200);
                break;
              }
              p = p.parentElement;
            }
            return {
              index: idx,
              tagName: input.tagName,
              type: input.type,
              id: input.id,
              name: input.name,
              placeholder: input.placeholder,
              ariaLabel: input.getAttribute('aria-label'),
              value: input.value,
              outerHTML: input.outerHTML.substring(0, 300),
              parentText
            };
          });

          const buttons = Array.from(document.querySelectorAll('button'));
          const buttonDetails = buttons.map((btn, idx) => ({
            index: idx,
            text: btn.textContent.trim(),
            outerHTML: btn.outerHTML.substring(0, 300),
            disabled: btn.disabled || btn.getAttribute('disabled') !== null
          }));

          return { inputs: inputDetails, buttons: buttonDetails };
        })()`,
        returnByValue: true
      });

      console.log("=== Inputs ===");
      console.log(JSON.stringify(infoResult.result.value.inputs, null, 2));
      console.log("=== Buttons ===");
      console.log(JSON.stringify(infoResult.result.value.buttons, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
