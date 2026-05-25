import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const OVERVIEW_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/overview`;

async function run() {
    console.log("[compliance-bot] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        console.log(`[compliance-bot] Found ${pages.length} active tabs.`);
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("[compliance-bot] No Play Console tab found. Opening a new tab...");
            page = await ctx.newPage();
        } else {
            console.log(`[compliance-bot] Attaching directly to existing tab: "${await page.title()}"`);
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // ==========================================
        // 1. FINANCIAL FEATURES DECLARATION
        // ==========================================
        console.log("\n[compliance-bot] --- 1. Processing Financial Features ---");
        const financeUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/finance`;
        console.log(`[compliance-bot] Navigating directly to Financial Features form: ${financeUrl}`);
        await page.goto(financeUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        // Fill out checkbox or click Next / Save
        await page.evaluate(() => {
            const checkbox = Array.from(document.querySelectorAll('mat-checkbox, console-checkbox, label')).find(el => el.textContent.includes("doesn't provide any financial features"));
            if (checkbox) checkbox.click();
        });
        await page.waitForTimeout(2000);

        // Click Save if enabled
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Save');
            if (btn && !btn.disabled) btn.click();
        });
        await page.waitForTimeout(4000);

        // Click Next
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Next');
            if (btn && !btn.disabled) btn.click();
        });
        await page.waitForTimeout(4000);

        // Click Save on step 2 Documentation
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Save');
            if (btn && !btn.disabled) btn.click();
        });
        await page.waitForTimeout(4000);

        // Dismiss modal if present
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Not now');
            if (btn) btn.click();
        });
        await page.waitForTimeout(2000);

        await page.screenshot({ path: resolve(rootDir, "financial_features_completed.png") });
        console.log("[compliance-bot] Financial Features saved.");

        // ==========================================
        // 2. GOVERNMENT APPS DECLARATION
        // ==========================================
        console.log("\n[compliance-bot] --- 2. Processing Government Apps ---");
        const govUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/government-apps`;
        await page.goto(govUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        // Select No
        const govSelected = await page.evaluate(() => {
            const radios = Array.from(document.querySelectorAll('mat-radio-button, console-radio-button, [role="radio"]'));
            const noRadio = radios.find(el => el.textContent.trim().toLowerCase() === 'no');
            if (noRadio) {
                noRadio.click();
                return true;
            }
            return false;
        });

        if (govSelected) {
            console.log("[compliance-bot] Selected 'No' for Government apps.");
            await page.waitForTimeout(2000);
            
            // Save
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Save');
                if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(4000);

            // Dismiss modal
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Not now');
                if (btn) btn.click();
            });
            await page.waitForTimeout(2000);
        } else {
            console.log("[compliance-bot] Warning: Government apps 'No' radio not found.");
        }

        await page.screenshot({ path: resolve(rootDir, "government_apps_completed.png") });

        // ==========================================
        // 3. HEALTH APPS DECLARATION
        // ==========================================
        console.log("\n[compliance-bot] --- 3. Processing Health Apps ---");
        const healthUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/health`;
        await page.goto(healthUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        // Select checkbox "My app does not have any health features"
        await page.evaluate(() => {
            const checkbox = Array.from(document.querySelectorAll('mat-checkbox, console-checkbox, label')).find(el => el.textContent.includes("does not have any health features"));
            if (checkbox) checkbox.click();
        });
        await page.waitForTimeout(2000);

        // Click Next
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Next');
            if (btn && !btn.disabled) btn.click();
        });
        await page.waitForTimeout(4000);

        // Save
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Save');
            if (btn && !btn.disabled) btn.click();
        });
        await page.waitForTimeout(4000);

        // Dismiss modal
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Not now');
            if (btn) btn.click();
        });
        await page.waitForTimeout(2000);

        await page.screenshot({ path: resolve(rootDir, "health_apps_completed.png") });
        console.log("[compliance-bot] Health apps saved.");

        // ==========================================
        // 4. CONTENT RATINGS QUESTIONNAIRE
        // ==========================================
        console.log("\n[compliance-bot] --- 4. Processing Content Ratings ---");
        const ratingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/content-rating-overview`;
        await page.goto(ratingUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        const ratingStarted = await page.evaluate(() => {
            const editBtn = Array.from(document.querySelectorAll('a, span, button')).find(el => el.textContent.trim() === 'Edit');
            if (editBtn) {
                editBtn.click();
                return true;
            }
            const startBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Start questionnaire') || el.textContent.includes('Start new questionnaire'));
            if (startBtn) {
                startBtn.click();
                return true;
            }
            return false;
        });

        if (ratingStarted) {
            await page.waitForTimeout(6000);
            console.log(`[compliance-bot] Questionnaires page loaded: ${page.url()}`);

            // 4a. Step 1: Category & Email
            const emailInputExists = await page.evaluate(() => {
                const emailInput = document.querySelector('input[type="email"], input[aria-label*="email"], input[aria-label*="Email"]');
                if (emailInput) {
                    emailInput.value = 'igor@iganapolsky.com';
                    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                    emailInput.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            });

            if (emailInputExists) {
                console.log("[compliance-bot] Step 1 Category Screen: Filled email. Selecting utility category...");
                await page.evaluate(() => {
                    const radios = Array.from(document.querySelectorAll('mat-radio-button, console-radio-button, [role="radio"]'));
                    const utilityRadio = radios.find(el => el.textContent.includes("Utility") || el.textContent.includes("productivity") || el.textContent.includes("other"));
                    if (utilityRadio) utilityRadio.click();
                });
                await page.waitForTimeout(2000);

                // Click Next
                await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Next');
                    if (btn && !btn.disabled) btn.click();
                });
                await page.waitForTimeout(6000);
            }

            // 4b. Answer survey questions
            let surveyPageNum = 1;
            while (true) {
                console.log(`[compliance-bot] Answering survey questions on page #${surveyPageNum}...`);
                const hasRadios = await page.evaluate(() => {
                    const groups = Array.from(document.querySelectorAll('mat-radio-group, console-radio-group, [role="radiogroup"]'));
                    if (groups.length === 0) return false;

                    for (const g of groups) {
                        const noOption = Array.from(g.querySelectorAll('mat-radio-button, console-radio-button, [role="radio"]'))
                            .find(el => el.textContent.trim().toLowerCase() === 'no');
                        if (noOption) noOption.click();
                    }
                    return true;
                });

                if (!hasRadios) {
                    console.log("[compliance-bot] No radio groups found. Moving to rating calculation...");
                    break;
                }

                await page.waitForTimeout(2000);

                // Click Save
                await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Save');
                    if (btn && !btn.disabled) btn.click();
                });
                await page.waitForTimeout(3000);

                // Click Next
                const clickedNext = await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Next');
                    if (btn && !btn.disabled) {
                        btn.click();
                        return true;
                    }
                    return false;
                });

                if (!clickedNext) {
                    break;
                }
                
                await page.waitForTimeout(5000);
                surveyPageNum++;
            }

            // 4c. Calculate & Submit rating
            console.log("[compliance-bot] Submitting and applying rating calculation...");
            
            // Try clicking Calculate/Save
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Calculate' || el.textContent.trim() === 'Save' || el.textContent.trim() === 'Save rating');
                if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(4000);

            // Click Apply rating/Submit
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Submit' || el.textContent.trim() === 'Apply rating');
                if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(4000);

            await page.screenshot({ path: resolve(rootDir, "content_rating_completed.png") });
            console.log("[compliance-bot] Content Rating completed successfully!");
        }

        // ==========================================
        // 5. FINAL VERIFICATION
        // ==========================================
        console.log("\n[compliance-bot] --- 5. Final Verification ---");
        await page.goto(OVERVIEW_URL, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);
        await page.screenshot({ path: resolve(rootDir, "app_content_overview_state.png") });
        console.log("[compliance-bot] Completed remaining declarations. Saved final Overview screenshot.");

    } catch (e) {
        console.error("[compliance-bot] Error:", e.message);
    } finally {
        await browser.disconnect();
        console.log("[compliance-bot] CDP client disconnected safely.");
    }
}

run();
