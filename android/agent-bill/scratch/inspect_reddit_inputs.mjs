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

      const inputsResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const inputs = Array.from(document.querySelectorAll('input, textarea, [role="textbox"], button, [role="button"]'));
          return inputs.map(el => {
            return {
              tagName: el.tagName,
              id: el.id,
              className: el.className,
              placeholder: el.placeholder || el.getAttribute('placeholder'),
              role: el.role || el.getAttribute('role'),
              type: el.type || el.getAttribute('type'),
              innerText: el.innerText || '',
              textContent: el.textContent ? el.textContent.substring(0, 100) : '',
              value: el.value || '',
              ariaLabel: el.getAttribute('aria-label') || ''
            };
          });
        })()`,
        returnByValue: true
      });

      console.log("=== Found elements ===");
      console.log(JSON.stringify(inputsResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
