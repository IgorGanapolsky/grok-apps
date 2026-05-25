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

      const checkResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const results = [];
          const elements = Array.from(document.querySelectorAll('*'));
          for (const el of elements) {
            if (el.innerText && el.innerText.includes("participate in this community")) {
              results.push({
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                innerText: el.innerText,
                isVisible: el.offsetWidth > 0 && el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none'
              });
            }
          }
          return results;
        })()`,
        returnByValue: true
      });

      console.log("=== Banned Message Elements ===");
      console.log(JSON.stringify(checkResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
