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

      const buttonDetails = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
          
          return buttons.map(b => ({
            tagName: b.tagName,
            text: b.textContent.trim(),
            className: b.className,
            disabled: b.disabled || b.getAttribute('disabled') || b.getAttribute('aria-disabled'),
            role: b.getAttribute('role')
          })).filter(b => b.text.length > 0);
        })()`,
        returnByValue: true
      });

      console.log("Interactive buttons:\n", JSON.stringify(buttonDetails.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
