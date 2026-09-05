/* Optional real-browser regression checks. Uses an isolated browser profile and ephemeral local server. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let playwright;
try { playwright = require('playwright'); }
catch { if (!process.env.TOEIC_PLAYWRIGHT_PATH) throw new Error('Install Playwright in your tooling environment or set TOEIC_PLAYWRIGHT_PATH to its module path.'); playwright = require(process.env.TOEIC_PLAYWRIGHT_PATH); }
const readState = page => page.evaluate(() => JSON.parse(localStorage.getItem('toeic_master_data')));
const nav = async (page, name) => { await page.evaluate(name => window.navigateTo(name), name); await page.locator(`#page-${name}.active`).waitFor(); };
let browser, server, page;
(async () => {
  const { createAppServer } = await import(pathToFileURL(path.resolve('server.js')));
  server = createAppServer({ env: {} }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await playwright.chromium.launch({ headless: true, ...(process.env.TOEIC_BROWSER_CHANNEL ? { channel: process.env.TOEIC_BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  page = await context.newPage(); page.setDefaultTimeout(12000);
  const errors = []; const dialogs = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await fs.mkdir('test-results', { recursive: true });
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#learningHome h1').waitFor();
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true, animations: 'disabled' });
  console.log('PASS desktop home renders real empty state');

  await nav(page, 'profile');
  await page.locator('[name=targetScore]').fill('800'); await page.locator('[name=dailyMinutes]').fill('20');
  await page.locator('[name=weakParts][value="5"]').check(); await page.locator('#learningProfileForm button[type=submit]').click();
  await page.locator('#page-home.active').waitFor(); assert.equal((await readState(page)).profile.targetScore, 800);
  await page.locator('#learningHome [data-learn=diagnostic]').click(); await page.locator('[data-learn=diagnostic-start]').click();
  await page.locator('.learn-option').first().click(); const active = (await readState(page)).learningAttempt;
  assert.equal(active.answers.length, 1);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#learningHome [data-learn=resume]').click();
  assert.equal(await page.locator('.learn-option.selected').count(), 1);
  await page.locator('[data-learn=submit]').first().click(); await page.locator('.learning-result').waitFor();
  let state = await readState(page); assert.equal(state.history.length, 1); assert.equal(state.history[0].answered, 1); assert.equal(state.history[0].assisted, true);
  assert.equal(Object.keys(state.dailyPlans).length, 7);
  await page.screenshot({ path: 'test-results/diagnostic-result.png', fullPage: false, animations: 'disabled' });
  await nav(page, 'review'); assert.ok(await page.locator('.review-card').count() > 0);
  console.log('PASS onboarding, diagnostic resume/reload, exact counts, seven-day plan and review');

  await nav(page, 'admin'); await page.locator('#btnAddNewExercise').waitFor();
  await page.locator('[data-action=edit][data-id="reading-p6-001"]').click();
  await page.locator('[name="sub-0-q"]').fill('Choose the best connector for blank (1).');
  await page.locator('#btnSaveEdit').click(); await page.locator('#adminModal').waitFor({ state: 'hidden' });
  state = await readState(page); assert.equal(state.customExercises.find(q => q.id === 'reading-p6-001').questions[0].q, 'Choose the best connector for blank (1).');
  await page.locator('[data-action=edit][data-id="vocab-business-001"]').count().then(async count => {
    if (!count) {
      await page.locator('#bankFilterSkill').selectOption('vocabulary');
      await page.locator('[data-action=edit]').first().click();
    } else await page.locator('[data-action=edit][data-id="vocab-business-001"]').click();
  });
  await page.locator('[name=meaning]').fill('Nghĩa đã cập nhật trong bài kiểm thử'); await page.locator('#btnSaveEdit').click(); await page.locator('#adminModal').waitFor({state:'hidden'});
  await page.locator('#bankFilterSkill').selectOption('all');
  await page.locator('#btnImportJson').click(); await page.locator('#importJsonText').fill('{broken'); await page.locator('#btnExecuteImport').click();
  assert.match(await page.locator('#importValidationErrors').innerText(), /JSON/);
  const imported = { id:'browser-import-1',skill:'reading',part:5,type:'single-choice',q:'Yesterday the manager _____ the report.',options:['reviewed','reviewing','reviews','review'],correct:0,explanation:'Yesterday requires the past simple.',status:'approved',questionType:'verb-tense' };
  await page.locator('#importJsonText').fill(JSON.stringify([imported])); await page.locator('#btnExecuteImport').click(); await page.locator('#adminModal').waitFor({state:'hidden'});
  assert.ok((await readState(page)).customExercises.some(q => q.id === imported.id));
  console.log('PASS grouped question editing, vocabulary editing, invalid/valid JSON import');

  await page.locator('[data-subtab=ai]').click(); await page.locator('#aiSkill').selectOption('reading'); await page.locator('#aiPart').selectOption('5'); await page.locator('#aiCount').fill('1');
  await page.locator('#btnTestAiMock').click(); await page.locator('.btn-approve-draft').first().waitFor();
  state = await readState(page); const draft = state.customExercises.find(q => q.source === 'ai-mock'); assert.equal(draft.status, 'draft');
  await page.reload({waitUntil:'domcontentloaded'}); await page.locator('#learningHome h1').waitFor(); await nav(page,'admin'); await page.locator('[data-subtab=ai]').click();
  await page.locator('.btn-edit-draft').first().click(); await page.locator('[name=explanation]').fill('Reviewed sample explanation.'); await page.locator('#btnSaveEdit').click(); await page.locator('#adminModal').waitFor({state:'hidden'});
  assert.equal((await readState(page)).customExercises.find(q => q.id === draft.id).explanation, 'Reviewed sample explanation.');
  await page.locator('.btn-approve-draft').first().click();
  assert.equal((await readState(page)).customExercises.find(q => q.id === draft.id).status, 'approved');
  await page.locator('#btnSubmitAiGenerate').click(); await page.waitForFunction(() => !document.getElementById('btnSubmitAiGenerate').disabled);
  assert.ok(dialogs.some(message => message.includes('OPENAI_API_KEY')));
  console.log('PASS explicit mock -> persisted draft -> edited draft -> approval; missing real key reports error');

  await nav(page,'reading'); await page.locator('#readingTabs .tab').nth(1).click(); await page.locator('[data-question="0"]').first().waitFor();
  for(let i=0;i<3;i++) await page.locator(`[data-question="${i}"][data-option="0"]`).click();
  await page.locator('[data-check]').click(); const count = (await readState(page)).history.length;
  await nav(page,'home'); await nav(page,'reading'); await page.locator('[data-retry]').waitFor(); assert.equal((await readState(page)).history.length,count);
  await nav(page,'grammar'); for (const i of [2,3,4]) { await page.locator('#grammarTabs .tab').nth(i).click(); await page.locator('.rule-card').first().waitFor(); }
  console.log('PASS multi-question reading scores once across navigation; all grammar tabs load');

  await nav(page,'mocktest'); await page.locator('#btnStartMock').click(); await page.locator('[data-opt-idx="0"]').first().click();
  const before = (await readState(page)).activeAttempts.mock;
  await nav(page,'home'); await nav(page,'mocktest'); await page.locator('#mockTimer').waitFor();
  await page.reload({waitUntil:'domcontentloaded'}); await page.locator('#learningHome h1').waitFor(); await nav(page,'mocktest'); await page.locator('#mockTimer').waitFor();
  state=await readState(page); assert.equal(state.activeAttempts.mock.deadline,before.deadline); assert.deepEqual(state.activeAttempts.mock.session.answers,before.session.answers);
  console.log('PASS mock test preserves original timer and answers across reload');

  await nav(page,'speaking'); await page.locator('#btnRecordPractice').click(); await page.waitForTimeout(1100); await page.locator('#btnRecordPractice').click();
  assert.equal((await readState(page)).skillSpeaking, 1);
  await nav(page,'writing'); await page.locator('#writingInput').fill('The employee is preparing a presentation for the meeting.');
  await nav(page,'home'); await nav(page,'writing'); assert.match(await page.locator('#writingInput').inputValue(), /preparing a presentation/);
  await page.locator('#btnSubmitWriting').click(); assert.equal((await readState(page)).skillWriting, 1);
  await nav(page,'home'); await nav(page,'writing'); assert.equal(await page.locator('#writingInput').getAttribute('readonly'), '');
  await nav(page,'admin'); await page.locator('[data-subtab=bank]').click();
  const downloadWait = page.waitForEvent('download'); await page.locator('#btnExportAllJson').click(); const download = await downloadWait;
  const exported = JSON.parse(await fs.readFile(await download.path(),'utf8')); assert.ok((Array.isArray(exported) ? exported : exported.items).length > 80);
  console.log('PASS Speaking records duration; Writing draft and completed response persist; full bank export downloads');

  for (const width of [390,768,1440]) {
    await page.setViewportSize({width,height:900});
    for(const route of ['home','roadmap','progress','review','journal','profile','admin']) {
      await nav(page,route); if(route==='admin') await page.locator('.admin-tabs-nav').waitFor();
      const overflow=await page.evaluate(()=>{ const el=document.querySelector('.main-content'); return el.scrollWidth > el.clientWidth + 3; });
      assert.equal(overflow,false,`${route} overflows at ${width}px`);
    }
    await nav(page,'home'); await page.screenshot({path:`test-results/home-${width}.png`,fullPage:false,animations:'disabled'});
  }
  await page.setViewportSize({width:390,height:844}); await page.locator('.mobile-menu-btn').click();
  assert.equal(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')),true);
  await page.locator('.nav-item[data-page="roadmap"]').click();
  assert.equal(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')),false);
  assert.deepEqual(errors,[]); console.log('PASS 390/768/1440 layouts, mobile menu, zero runtime errors');
})().catch(async error => { console.error(error); try { await page?.screenshot({path:'test-results/failure.png'}); } catch {} process.exitCode=1; })
.finally(async()=>{ await browser?.close(); if(server) await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}); });
