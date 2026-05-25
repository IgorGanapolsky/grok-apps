async function run() {
  console.log("Fetching active targets...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.url.includes("play.google.com/console") && t.url.includes("/app-content/finance"));
  if (!target) {
    console.error("ERROR: Not currently on the Financial features page.");
    process.exit(1);
  }

  console.log(`Connecting to: "${target.title}"`);
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

      const labelResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
          
          return inputs.map((input, idx) => {
            // Find parent element to get label text
            let parent = input.parentElement;
            let text = "";
            
            // Go up to find label container text
            while (parent && parent !== document.body) {
              const textVal = parent.innerText || "";
              if (textVal.length > 0 && textVal.length < 200 && !textVal.includes("\\n")) {
                text = textVal.trim();
                break;
              }
              // If it includes newlines but is short, take the first line
              if (textVal.length > 0 && textVal.length < 300) {
                text = textVal.split("\\n").map(s => s.trim()).filter(s => s.length > 0)[0] || "";
                break;
              }
              parent = parent.parentElement;
            }
            
            return {
              index: idx,
              checked: input.checked,
              labelText: text || input.id || input.name
            };
          });
        })()`,
        returnByValue: true
      });

      console.log("Checkboxes with labels (v2):\n", JSON.stringify(labelResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
