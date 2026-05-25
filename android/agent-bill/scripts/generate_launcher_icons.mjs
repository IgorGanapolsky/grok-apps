import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const CHOSEN_ICON = "/Users/igorganapolsky/.gemini/antigravity/brain/951228a6-1c75-48ef-b181-e8df8cd6f2b3/agentbill_loop_icon_1779305335096.png";

const DEST_BRAND = join(rootDir, "brand/icon-512.png");
const DEST_ASSETS = join(rootDir, "assets/icon_512.png");
const DEST_FASTLANE = join(rootDir, "fastlane/metadata/android/en-US/images/icon/icon-512.png");

const RES_DIR = join(rootDir, "app/src/main/res");

const DENSITIES = [
    { name: "mipmap-mdpi", size: 48 },
    { name: "mipmap-hdpi", size: 72 },
    { name: "mipmap-xhdpi", size: 96 },
    { name: "mipmap-xxhdpi", size: 144 },
    { name: "mipmap-xxxhdpi", size: 192 }
];

function run() {
    console.log("[generate-icons] Starting launcher icon generation...");

    if (!existsSync(CHOSEN_ICON)) {
        console.error(`Error: Source icon not found at ${CHOSEN_ICON}`);
        process.exit(1);
    }

    // Ensure directories exist
    mkdirSync(dirname(DEST_BRAND), { recursive: true });
    mkdirSync(dirname(DEST_ASSETS), { recursive: true });
    mkdirSync(dirname(DEST_FASTLANE), { recursive: true });

    // Convert to proper PNG format for high-res destinations
    console.log(`[generate-icons] Converting source JPEG icon to standard PNG format...`);
    execSync(`sips -s format png "${CHOSEN_ICON}" --out "${DEST_BRAND}"`, { stdio: "ignore" });
    execSync(`sips -s format png "${CHOSEN_ICON}" --out "${DEST_ASSETS}"`, { stdio: "ignore" });
    execSync(`sips -s format png "${CHOSEN_ICON}" --out "${DEST_FASTLANE}"`, { stdio: "ignore" });

    // Generate mipmaps in standard PNG format
    for (const density of DENSITIES) {
        const destDir = join(RES_DIR, density.name);
        mkdirSync(destDir, { recursive: true });

        const standardPath = join(destDir, "ic_launcher.png");
        const roundPath = join(destDir, "ic_launcher_round.png");

        console.log(`[generate-icons] Generating ${density.name} (${density.size}x${density.size})...`);
        
        // Use sips to resize and convert to png format
        execSync(`sips -s format png -z ${density.size} ${density.size} "${CHOSEN_ICON}" --out "${standardPath}"`, { stdio: "ignore" });
        execSync(`sips -s format png -z ${density.size} ${density.size} "${CHOSEN_ICON}" --out "${roundPath}"`, { stdio: "ignore" });
    }

    console.log("[generate-icons] Launcher icons generated successfully!");
}

run();
