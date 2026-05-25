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

      const parentDetails = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const bnplEl = elements.find(el => el.textContent.trim() === 'Buy now, pay later');
          if (!bnplEl) return { error: "Buy now, pay later not found" };
          
          const path = [];
          let current = bnplEl;
          for (let i = 0; i < 6; i++) {
            if (!current) break;
            path.push({
              tagName: current.tagName,
              className: current.className,
              id: current.id,
              innerHTML: current.innerHTML.slice(0, 100)
            });
            current = current.parentElement;
          }
          return path;
        })()`,
        returnByValue: true
      });

      console.log("Buy now, pay later parent path:\n", JSON.stringify(parentDetails.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
