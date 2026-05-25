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

      const infoResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const res = {};
          
          // Look for title element
          const titleEl = document.querySelector('[placeholder="Title"]') || document.querySelector('[aria-label="Title"]') || document.querySelector('textarea[name="title"]') || document.querySelector('input[name="title"]');
          if (titleEl) {
            res.titleSelector = {
              tagName: titleEl.tagName,
              id: titleEl.id,
              className: titleEl.className,
              placeholder: titleEl.getAttribute('placeholder'),
              ariaLabel: titleEl.getAttribute('aria-label'),
              name: titleEl.getAttribute('name')
            };
          } else {
            res.titleSelector = 'NOT FOUND';
          }

          // Look for body element
          const bodyEl = document.querySelector('[aria-label="Post body text field"]') || document.querySelector('[aria-label="Optional Body text field"]') || document.querySelector('[role="textbox"]') || document.querySelector('textarea[name="text"]');
          if (bodyEl) {
            res.bodySelector = {
              tagName: bodyEl.tagName,
              id: bodyEl.id,
              className: bodyEl.className,
              placeholder: bodyEl.getAttribute('placeholder'),
              ariaLabel: bodyEl.getAttribute('aria-label'),
              role: bodyEl.getAttribute('role')
            };
          } else {
            res.bodySelector = 'NOT FOUND';
          }

          // Look for submit/post button
          const buttons = Array.from(document.querySelectorAll('button'));
          const postButton = buttons.find(b => b.innerText.includes('Post') || b.textContent.includes('Post'));
          if (postButton) {
            res.postButtonSelector = {
              tagName: postButton.tagName,
              id: postButton.id,
              className: postButton.className,
              innerText: postButton.innerText,
              disabled: postButton.disabled
            };
          } else {
            res.postButtonSelector = 'NOT FOUND';
          }

          return res;
        })()`,
        returnByValue: true
      });

      console.log("=== Specific selectors result ===");
      console.log(JSON.stringify(infoResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
