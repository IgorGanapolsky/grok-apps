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
  console.log("Scanning DOM for file inputs...");

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
    await page.waitForTimeout(10000);

    // Scan for all file inputs and detail their parents
    const inputsInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input[type='file']"));
      return inputs.map((input, idx) => {
        // Traverse up to find some identifying parent text
        let parentText = "";
        let current = input.parentElement;
        for (let i = 0; i < 5 && current; i++) {
          if (current.innerText && current.innerText.trim().length > 0) {
            parentText = current.innerText.trim().replace(/\n/g, " | ").substring(0, 200);
            break;
          }
          current = current.parentElement;
        }

        return {
          index: idx,
          id: input.id,
          name: input.name,
          className: input.className,
          accept: input.getAttribute("accept"),
          parentTag: input.parentElement ? input.parentElement.tagName : null,
          parentClass: input.parentElement ? input.parentElement.className : null,
          parentTextNear: parentText
        };
      });
    });

    console.log("All found file inputs:", JSON.stringify(inputsInfo, null, 2));

  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await ctx.close().catch(() => {});
  }
}

run();
