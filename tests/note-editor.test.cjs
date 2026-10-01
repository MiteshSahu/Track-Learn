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
 await page.evaluate(()=>switchTab('amazonprep'));
 await page.locator('#ap-results [data-open="lc-1"]').click();
 const editor=page.locator('#ap-question-note');
 async function setHTML(html){await editor.evaluate((el,html)=>{el.innerHTML=html;el.dispatchEvent(new Event('input',{bubbles:true}));},html);}
 async function select(start=0,end=null){await editor.evaluate((el,{start,end})=>{el.focus();const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let offset=0,n,begun=false;const r=document.createRange();end=end??el.textContent.length;while(n=walker.nextNode()){if(!begun&&start<=offset+n.length){r.setStart(n,start-offset);begun=true;}if(begun&&end<=offset+n.length){r.setEnd(n,end-offset);break;}offset+=n.length;}const s=getSelection();s.removeAllRanges();s.addRange(r);},{start,end});}
 const action=name=>page.locator('.ap-inline-panel.open .note-format-btn[data-action="'+name+'"]').first().click();
 await setHTML('');
 await editor.evaluate(el=>{el.focus();const data=new DataTransfer();data.setData('text/html','<li style="margin-left:-60px">Build prefix product <code>left[i]</code></li><li>Second point<ul style="padding:0"><li>Nested point</li></ul></li><ol style="padding:0"><li>Numbered point</li></ol>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 assert.equal(await editor.locator('[style]').count(),0);
 assert.equal(await editor.locator('li').count(),4);
 assert.equal(await editor.locator('code').innerText(),'left[i]');
 assert.equal(await editor.evaluate(el=>[...el.querySelectorAll('li')].every(li=>li.getBoundingClientRect().left>=el.getBoundingClientRect().left+24)),true);
 await page.getByRole('button',{name:'Save Note',exact:true}).click();await page.reload();await page.locator('#ap-results [data-open="lc-1"]').click();
 assert.equal(await editor.locator('li').count(),4);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await editor.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.setViewportSize({width:1280,height:900});
 const sample='<div>First <b>bold text</b></div><div>Second <code>code</code></div><ul><li>List one</li><li>List two</li></ul><table><tbody><tr><td>Cell one</td><td>Cell two</td></tr></tbody></table>';
 await setHTML(sample);
 const before=await editor.innerText();
 await select();await action('highlight');
 assert.equal(await editor.innerText(),before);
 assert.equal(await editor.locator('mark div,mark ul,mark li,mark table,mark td').count(),0);
 assert.equal(await editor.locator('b').innerText(),'bold text');
 await page.getByRole('button',{name:'Save Note',exact:true}).click();await page.reload();await page.locator('#ap-results [data-open="lc-1"]').click();
 assert.equal(await editor.innerText(),before);assert.ok(await editor.locator('mark').count()>3);
 await select();await action('highlight');assert.equal(await editor.locator('mark').count(),0);assert.equal(await editor.innerText(),before);
 await setHTML('<div><mark><b>abcdef</b></mark></div>');await select(2,4);await action('highlight');
 assert.deepEqual(await editor.locator('mark').allTextContents(),['ab','ef']);assert.equal(await editor.textContent(),'abcdef');assert.equal(await editor.locator('b').allTextContents().then(a=>a.join('')),'abcdef');
 await setHTML('<div>Bold me</div>');await select();await action('bold');assert.ok(await editor.locator('b,strong').count());
 await setHTML('<div>One</div><div>Two</div>');await select();await action('bullet');assert.ok(await editor.locator('li').count()>=2);
 await setHTML('<div>One</div><div>Two</div>');await select();await action('checklist');
 await editor.locator('input[type=checkbox]').first().check();assert.equal(await editor.locator('input[type=checkbox]').first().getAttribute('checked'),'');
 await page.getByRole('button',{name:'Save Note',exact:true}).click();await page.reload();await page.locator('#ap-results [data-open="lc-1"]').click();assert.equal(await editor.locator('input[type=checkbox]').first().isChecked(),true);
 await setHTML('<div>| A | B |</div><div>| --- | --- |</div><div>| 1 | 2 |</div>');await select();await action('table');assert.equal(await editor.locator('table').count(),1);
 await setHTML('<div>Keep</div><div><br></div><div>Me</div>');await action('compact');assert.equal(await editor.locator('div').count(),2);
 // Verify the shared fix also runs in the original DSA editor.
 await page.locator('#tabBar').getByRole('button',{name:'DSA',exact:true}).click();
 await page.locator('.expandable-q-row').first().click();
 const oldEditor=page.locator('.q-note-panel.open .note-edit-surface').first();
 await oldEditor.evaluate(el=>{el.innerHTML='<div>First</div><div><b>Second</b></div>';el.focus();const range=document.createRange();range.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(range);});
 const oldText=await oldEditor.innerText();await page.locator('.q-note-panel.open [data-action=highlight]').first().click();assert.equal(await oldEditor.innerText(),oldText);
 assert.deepEqual(errors,[]);console.log('PASS: multi-block highlight, save/reload, full/partial removal, bold, bullets, checklist persistence, tables, compact, original DSA editor');
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
