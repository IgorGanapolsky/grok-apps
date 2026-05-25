import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

async function run() {
  const CANARY_BIN = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
  const CANARY_PROFILE = join(homedir(), "Library", "Application Support", "Google", "Chrome Canary");
  const DEV_ID = "5569424694437250668";
  const U_INDICES = ["u/0", "u/1", "u/2", "u/3"];

  if (!existsSync(CANARY_BIN)) {
    console.error(`Chrome Canary not found at ${CANARY_BIN}`);
    process.exit(1);
  }

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(CANARY_PROFILE, {
      headless: true, 
      executablePath: CANARY_BIN,
      viewport: { width: 1440, height: 900 },
      ignoreDefaultArgs: ["--enable-automation", "--no-first-run", "--no-default-browser-check"],
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (err) {
    if (err.message.includes("lock") || err.message.includes("user data directory is already in use")) {
        console.error("Browser profile is locked. Please close Chrome Canary or start it with:");
        console.error(`"${CANARY_BIN}" --remote-debugging-port=9222`);
        process.exit(1);
    }
    throw err;
  }

  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    for (const uIndex of U_INDICES) {
      const targetUrl = `https://play.google.com/console/${uIndex}/developers/${DEV_ID}/apps-list`;
      console.log(`\n--- Trying ${targetUrl} ---`);
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 20000 }).catch(() => null);

      if (page.url().includes("accounts.google.com")) {
        console.log(`[${uIndex}] Redirected to login: ${page.url().split('?')[0]}`);
        continue;
      }

      console.log(`[${uIndex}] Reached page: ${page.url()}`);
      
      // Wait for content
      await page.waitForTimeout(5000); 

      const content = await page.content();
      const hasAgentBill = content.toLowerCase().includes("agentbill");
      const hasRandomTimer = content.toLowerCase().includes("random-timer");

      console.log(`[${uIndex}] Page content check: hasAgentBill=${hasAgentBill}, hasRandomTimer=${hasRandomTimer}`);

      if (hasAgentBill) {
        console.log(`Found AgentBill in ${uIndex}!`);
        const appRow = page.locator('tr').filter({ hasText: /AgentBill/i });
        if (await appRow.count() > 0) {
          const statusText = await appRow.innerText();
          console.log(`Status Row: ${statusText.replace(/\n/g, ' ')}`);
          
          await appRow.locator('a').first().click();
          await page.waitForLoadState("networkidle");
          const dashboardUrl = page.url();
          console.log(`Dashboard URL: ${dashboardUrl}`);
          
          const internalTestingUrl = dashboardUrl.replace(/\/dashboard$/, "/internal-testing");
          await page.goto(internalTestingUrl, { waitUntil: "networkidle" });
          console.log(`Internal testing URL: ${page.url()}`);
          
          await ctx.close();
          return;
        } else {
          console.log("AgentBill found in text but not in a table row. Page might be loading or in a different state.");
        }
      } else if (hasRandomTimer) {
        console.log(`Found Random-Timer but NOT AgentBill in ${uIndex}. This suggests AgentBill is not yet created in this account.`);
        await ctx.close();
        return;
      }
    }

    console.log("\nCould not find AgentBill or Random-Timer in any u/ index or all were redirected to login.");
    await page.screenshot({ path: "failure_final.png" });

  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    await ctx.close();
  }
}

run();
