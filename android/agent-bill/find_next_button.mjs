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

      const searchResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const allElements = Array.from(document.querySelectorAll('*'));
          const matches = [];
          allElements.forEach((el, index) => {
            if (el.innerText && el.innerText.trim() === 'Next') {
              matches.push({
                index,
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                role: el.getAttribute('role'),
                parentTagName: el.parentElement ? el.parentElement.tagName : null,
                parentClassName: el.parentElement ? el.parentElement.className : null
              });
            }
          });
          return matches;
        })()`,
        returnByValue: true
      });
      console.log("Found matches for 'Next' text:");
      console.log(JSON.stringify(searchResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
