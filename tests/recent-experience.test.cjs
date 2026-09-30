// Run with NODE_PATH pointing at Playwright. Uses an isolated browser and local test server.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
 const server=http.createServer((req,res)=>{const file=req.url==='/'?'index.html':req.url.slice(1);if(!['index.html','amazon-prep.js','amazon-prep-data.js','amazon-prep.css','favicon.svg'].includes(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(path.join(__dirname,'..',file)));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true, channel:process.env.PLAYWRIGHT_CHANNEL || "chrome"});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.route('**/*supabase*',route=>route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('button',{name:'Amazon SDE II Preparation',exact:true}).click();
 const tagged=await page.evaluate(()=>AMAZON_PREP_DATA.questions.filter(q=>q.recentExperience).map(q=>q.num));
 assert.equal(tagged.length,12);assert.equal(new Set(tagged).size,12);
 await page.evaluate(()=>{const p=state.amazonPrep;p.questions['lc-210'].confidence=5;const before=JSON.stringify(state);AmazonPrep.migrate(state);if(JSON.stringify(state)!==before)throw new Error('Migration not idempotent');});
 await page.locator('[data-tab="Recent Experience"]').click();
 assert.equal(await page.locator('#ap-recent-content .ap-q').count(),12);
 for(const [section,count] of [['Patterns',6],['HLD',5],['LLD',5],['Leadership',6],['GenAI',2]]){
   await page.locator('[data-recent-section="'+section+'"]').click();
   assert.equal(await page.locator('#ap-recent-content .q-card').count(),count);
 }
 await page.locator('[data-recent-section="Patterns"]').click();
 await page.locator('[data-topic-done]').first().check();
 await page.locator('[data-topic-open]').first().click();await page.locator('#ap-topic-note').fill('Pattern notes');await page.getByRole('button',{name:'Save Note',exact:true}).click();
 await page.locator('[data-recent-section="Practice"]').click();
 assert.equal(await page.locator('#ap-recent-content .ap-priority,#ap-recent-content [data-open]').count(),0);
 assert.equal(await page.locator('#ap-recent-content').getByText('Graph',{exact:true}).count(),0);
 await page.locator('#ap-practice-body').fill('Plain text solve');
 await page.getByRole('button',{name:'Start',exact:true}).click();
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.locator('[data-field=dryRun]').check();await page.locator('[data-field=followUp]').check();
 await page.getByRole('button',{name:'Finish solve',exact:true}).click();
 const practice=await page.evaluate(()=>Object.values(state.amazonPrep.practice)[0]);assert.equal(practice.finished,true);assert.ok(practice.seconds>=1);assert.equal(practice.body,'Plain text solve');
 await page.reload();await page.locator('[data-tab="Recent Experience"]').click();await page.locator('[data-recent-section="Practice"]').click();
 assert.equal(await page.locator('#ap-practice-body').inputValue(),'Plain text solve');assert.equal(await page.locator('[data-field=dryRun]').isChecked(),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.evaluate(()=>state.amazonPrep.questions['lc-210'].confidence),5);
 assert.deepEqual(errors,[]);console.log('PASS: 12 unique tagged questions, all recent topic groups, idempotent migration, practice timer and saved draft/checks, mobile');
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
