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
            try {
              const elements = root.querySelectorAll('*');
              for (const el of elements) {
                results.push(el);
                if (el.shadowRoot) {
                  getAllElements(el.shadowRoot, results);
                }
              }
            } catch (e) {}
            return results;
          }

          const allElements = getAllElements();
          const matches = [];
          for (const el of allElements) {
            try {
              const tagName = (el.tagName || '').toLowerCase();
              const id = el.id || '';
              const className = el.className || '';
              const placeholder = el.getAttribute ? el.getAttribute('placeholder') : '';
              const ariaLabel = el.getAttribute ? el.getAttribute('aria-label') : '';
              const name = el.getAttribute ? el.getAttribute('name') : '';
              const text = el.innerText || el.textContent || '';

              // Check if it's the title element
              const isTitle = (placeholder && placeholder.toLowerCase().includes('title')) || 
                              (ariaLabel && ariaLabel.toLowerCase().includes('title')) || 
                              (name === 'title') || 
                              (tagName.includes('title-input'));

              // Check if it's the body element
              const isBody = (ariaLabel && ariaLabel.toLowerCase().includes('body')) || 
                             (placeholder && placeholder.toLowerCase().includes('body')) ||
                             (tagName.includes('editor') && tagName.includes('input'));

              // Check if it's a post / submit button
              const isButton = (tagName === 'button') || 
                               (el.getAttribute && el.getAttribute('role') === 'button') ||
                               (tagName === 'faceplate-tracker' && el.getAttribute('noun') === 'post');

              const isPostBtn = isButton && (text.includes('Post') || text.includes('post') || el.getAttribute('noun') === 'post');

              if (isTitle || isBody || isPostBtn) {
                // Find path of selectors to the element safely
                let path = [];
                let parent = el;
                while (parent && parent !== document) {
                  let segment = '';
                  if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                    segment = '#shadow-root';
                  } else {
                    segment = (parent.tagName || '').toLowerCase();
                    if (parent.id) {
                      segment += '#' + parent.id;
                      path.unshift(segment);
                      break;
                    } else if (parent.classList && parent.classList.length > 0) {
                      segment += '.' + Array.from(parent.classList).join('.');
                    }
                  }
                  path.unshift(segment);
                  parent = parent.parentNode || parent.host;
                }

                matches.push({
                  tagName,
                  id,
                  className,
                  placeholder,
                  ariaLabel,
                  name,
                  innerText: text.substring(0, 100).trim(),
                  isTitle,
                  isBody,
                  isPostBtn,
                  selectorPath: path.join(' > ')
                });
              }
            } catch (innerErr) {
              console.error(innerErr);
            }
          }

          return matches;
        })()`,
        returnByValue: true
      });

      console.log("=== Matching Elements (Filtered) ===");
      console.log(JSON.stringify(infoResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
