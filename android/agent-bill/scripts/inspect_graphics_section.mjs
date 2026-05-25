import { chromium } from "playwright";
import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const COMET_BIN = "/Applications/Comet.app/Contents/MacOS/Comet";
const COMET_PROFILE = join(homedir(), "Library/Application Support/Comet");
const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
  console.log("Analyzing graphics upload sections...");

  if (!existsSync(COMET_BIN)) {
    console.error(`Comet binary not found at ${COMET_BIN}`);
    process.exit(1);
  }
  if (!existsSync(COMET_PROFILE)) {
    console.error(`Comet profile not found at ${COMET_PROFILE}`);
    process.exit(1);
  }

  try {
    execSync("killall Comet", { stdio: "ignore" });
  } catch (e) {}

  await new Promise(resolve => setTimeout(resolve, 3000));

  const ctx = await chromium.launchPersistentContext(COMET_PROFILE, {
    headless: false,
    executablePath: COMET_BIN,
    viewport: { width: 1440, height: 900 },
    args: [
      "--no-first-run", 
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled"
    ],
    ignoreDefaultArgs: ["--enable-automation"]
  });

  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    const url = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/main-store-listing`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(15000);

    const structure = await page.evaluate(() => {
      // Find all elements with text "App icon" or "App Icon"
      const results = [];
      const walkers = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walkers.nextNode())) {
        const text = node.nodeValue.trim();
        if (text === "App icon" || text === "App Icon" || text === "Feature graphic" || text === "Feature Graphic") {
          let parent = node.parentElement;
          // Traverse up to 8 levels to show the container
          const parentChain = [];
          let current = parent;
          for (let i = 0; i < 6 && current; i++) {
            parentChain.push({
              tagName: current.tagName,
              className: current.className,
              outerHTML: current.outerHTML.substring(0, 300) + "..."
            });
            current = current.parentElement;
          }
          results.push({
            text,
            parentChain
          });
        }
      }
      return results;
    });

    console.log("Graphics Section DOM Structure:");
    console.log(JSON.stringify(structure, null, 2));

  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await ctx.close().catch(() => {});
  }
}

run();
