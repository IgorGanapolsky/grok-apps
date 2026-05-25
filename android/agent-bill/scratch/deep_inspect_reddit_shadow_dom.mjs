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
          function getAllElements(root = document, results = []) {
            // Find all elements under this root
            const elements = root.querySelectorAll('*');
            for (const el of elements) {
              results.push(el);
              if (el.shadowRoot) {
                getAllElements(el.shadowRoot, results);
              }
            }
            return results;
          }

          const allElements = getAllElements();
          console.log("Total traversed elements:", allElements.length);

          const matches = [];
          for (const el of allElements) {
            const tagName = el.tagName.toLowerCase();
            const id = el.id || '';
            const className = el.className || '';
            const placeholder = el.getAttribute ? el.getAttribute('placeholder') : '';
            const ariaLabel = el.getAttribute ? el.getAttribute('aria-label') : '';
            const name = el.getAttribute ? el.getAttribute('name') : '';
            const text = el.innerText || el.textContent || '';

            const isTitle = (placeholder && placeholder.toLowerCase().includes('title')) || 
                            (ariaLabel && ariaLabel.toLowerCase().includes('title')) || 
                            (name === 'title') || 
                            (tagName.includes('title-input'));

            const isBody = (ariaLabel && ariaLabel.toLowerCase().includes('body')) || 
                           (placeholder && placeholder.toLowerCase().includes('body')) ||
                           (tagName.includes('editor') && tagName.includes('input'));

            const isButton = (tagName === 'button') || 
                             (el.getAttribute && el.getAttribute('role') === 'button');

            const isPostBtn = isButton && (text.includes('Post') || text.includes('post'));

            if (isTitle || isBody || isPostBtn || tagName.includes('shreddit-') || tagName.includes('reddit-')) {
              matches.push({
                tagName,
                id,
                className,
                placeholder,
                ariaLabel,
                name,
                innerTextSnippet: text.substring(0, 100).trim(),
                isTitle,
                isBody,
                isPostBtn
              });
            }
          }

          return matches;
        })()`,
        returnByValue: true
      });

      console.log("=== Shadow DOM Traversed matches ===");
      console.log(JSON.stringify(infoResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
