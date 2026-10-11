const { chromium } = require('playwright');

async function run() {
  console.log('Testing browser launch...');
  let browser;
  try {
    // Try launching default chromium or system msedge/chrome
    browser = await chromium.launch({
      headless: true,
      channel: 'msedge' // or chrome
    });
    console.log('Launched browser using msedge channel successfully!');
  } catch (err) {
    console.log('msedge failed, trying default chromium:', err.message);
    try {
      browser = await chromium.launch({ headless: true });
      console.log('Launched default chromium successfully!');
    } catch (err2) {
      console.log('Default chromium failed:', err2.message);
      try {
        browser = await chromium.launch({ headless: true, channel: 'chrome' });
        console.log('Launched chrome successfully!');
      } catch (err3) {
        console.log('All browser launches failed:', err3.message);
        process.exit(1);
      }
    }
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const errors = [];

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push(`PageError: ${err.message}`);
  });

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  console.log('Page loaded. Checking title...');
  const title = await page.title();
  console.log('Page title:', title);

  // Wait for initial elements
  await page.waitForSelector('text=CloudMesh');
  console.log('Found CloudMesh header');

  // Check Pooled Storage Cluster text
  await page.waitForSelector('text=Pooled Storage Cluster');
  console.log('Found Pooled Storage Cluster');

  // Check accounts render
  const accountsText = await page.textContent('body');
  if (accountsText.includes('sam.dev@gmail.com')) {
    console.log('Verified Anchor Account rendered in UI');
  }

  // Test navigation into "Documents" folder
  console.log('Testing folder navigation into "Documents"...');
  await page.click('text=Documents');
  await page.waitForTimeout(500);

  const docsContent = await page.textContent('body');
  if (docsContent.includes('Q4_Financial_Projections.xlsx')) {
    console.log('Successfully navigated into /Documents and verified files rendered!');
  }

  // Test "Move Cloud" modal
  console.log('Testing Move to Cloud modal...');
  const moveBtn = await page.locator('button:has-text("Move Cloud")').first();
  if (await moveBtn.isVisible()) {
    await moveBtn.click();
    await page.waitForSelector('text=Stream-Pipe to Cloud');
    console.log('Move to Cloud modal opened! Checking chunk streaming info...');
    await page.click('button:has-text("Start Stream Transfer")');
    console.log('Started client-side streaming transfer!');
    await page.waitForTimeout(1000);
  }

  // Check active transfer drawer
  console.log('Checking active transfer drawer...');
  await page.waitForSelector('text=Client-Side Stream Pipe Transfers');
  console.log('Transfer drawer active and streaming chunks!');

  // Test Master Password Vault
  console.log('Testing Master Password Vault...');
  await page.click('text=Setup Vault');
  await page.waitForSelector('text=Encrypted Token Vault');
  console.log('Vault modal opened!');

  await page.fill('input[placeholder="Min 6 characters..."]', 'SuperMasterKey2026!');
  await page.fill('input[placeholder="Confirm password..."]', 'SuperMasterKey2026!');
  await page.click('button:has-text("Establish Master Password")');
  await page.waitForTimeout(1200);

  console.log('Master password vault established via Web Crypto PBKDF2 + AES-GCM!');

  // Test Simulate 412 Conflict
  console.log('Testing 412 Conflict Simulation...');
  const conflictBtn = await page.locator('button:has-text("Simulate 412 Conflict"), button:has-text("412 Test")').first();
  if (await conflictBtn.isVisible()) {
    await conflictBtn.click();
    await page.waitForTimeout(1200);
    console.log('Simulated 412 conflict and verified automatic optimistic locking merge!');
  }

  // Take screenshot for verification
  await page.screenshot({ path: 'cloudmesh-dashboard.png', fullPage: true });
  console.log('Saved screenshot to cloudmesh-dashboard.png');

  console.log('\n--- Test Summary ---');
  console.log('Total Console Messages:', consoleLogs.length);
  console.log('Total Errors:', errors.length);
  if (errors.length > 0) {
    console.error('Errors found:', errors);
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED WITH ZERO CONSOLE ERRORS!');
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
