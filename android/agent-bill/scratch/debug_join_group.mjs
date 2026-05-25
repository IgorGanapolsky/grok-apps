import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Chrome Canary CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        await page.setViewportSize({ width: 1440, height: 900 });

        const groupUrl = "https://groups.google.com/g/stairs-counter-closed-testing";
        console.log(`Navigating to Google Group: ${groupUrl}`);
        await page.goto(groupUrl, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(4000);

        await page.screenshot({ path: "scratch_group_loaded_pw.png" });

        // Let's find the join group button using a locator
        const joinBtnLocator = page.locator('div[role="button"]:has-text("Join group"), button:has-text("Join group"), div[role="button"]:has-text("Join this group")').first();
        const count = await joinBtnLocator.count();
        console.log(`Found ${count} join button(s) via locator.`);

        if (count > 0) {
            console.log("Clicking join button using Playwright click()...");
            await joinBtnLocator.click();

            console.log("Waiting 4 seconds for confirmation modal/dialog to load...");
            await page.waitForTimeout(4000);

            await page.screenshot({ path: "scratch_group_after_pw_click.png" });

            // Let's inspect the page content to see if a modal/dialog is open
            const pageState = await page.evaluate(() => {
                const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog, div[class*="modal"]'));
                const dialogInfo = dialogs.map(d => ({
                    innerText: d.innerText,
                    visible: !!(d.offsetWidth || d.offsetHeight),
                    buttons: Array.from(d.querySelectorAll('button, [role="button"]')).map(btn => btn.innerText)
                }));

                const allVisibleButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
                    .filter(btn => !!(btn.offsetWidth || btn.offsetHeight))
                    .map(btn => btn.innerText.trim());

                return { dialogInfo, allVisibleButtons };
            });

            console.log("Page state after click:", JSON.stringify(pageState, null, 2));

            // If there's a join button in the confirmation modal, let's see if we can find it and click it
            const modalJoinBtn = page.locator('dialog div[role="button"]:has-text("Join group"), [role="dialog"] div[role="button"]:has-text("Join group"), [role="dialog"] button:has-text("Join group")').first();
            const modalJoinCount = await modalJoinBtn.count();
            console.log(`Found ${modalJoinCount} join buttons in modal.`);
            if (modalJoinCount > 0) {
                console.log("Clicking the join button in the confirmation modal...");
                await modalJoinBtn.click();
                await page.waitForTimeout(4000);
                await page.screenshot({ path: "scratch_group_final_joined.png" });
                console.log("Final joined screenshot saved.");
            }
        } else {
            console.log("No join buttons found.");
        }

        await page.close();
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
