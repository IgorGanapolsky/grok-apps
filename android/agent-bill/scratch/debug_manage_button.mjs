async function run() {
  console.log("Fetching active targets...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.url.includes("play.google.com/console") && t.url.includes("/app-content/overview"));
  if (!target) {
    console.error("ERROR: Not currently on the App Content page.");
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

      console.log("Inspecting 'Manage' elements...");
      const elementsResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Let's find all 'Manage' elements and inspect their tag, class, parent tag, href, role, etc.
          const allEls = Array.from(document.querySelectorAll('*'));
          const manageEls = allEls.filter(el => el.textContent.trim() === 'Manage');
          
          return manageEls.map(el => {
            // Find container row text
            let parent = el.parentElement;
            let containerText = "";
            while (parent && parent !== document.body) {
              // check if it has headings or distinct texts
              const text = parent.innerText || "";
              if (text.includes("Financial features") || text.includes("Government apps") || text.includes("Health apps")) {
                containerText = text.split("\\n").slice(0, 3).join(" | ");
                break;
              }
              parent = parent.parentElement;
            }
            
            return {
              tagName: el.tagName,
              className: el.className,
              role: el.getAttribute('role'),
              href: el.getAttribute('href') || el.parentElement.getAttribute('href'),
              container: containerText
            };
          });
        })()`,
        returnByValue: true
      });

      console.log("Manage elements details:\n", JSON.stringify(elementsResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
