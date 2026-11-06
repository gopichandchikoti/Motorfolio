import {chromium} from 'playwright-core';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const name=JSON.parse(readFileSync('package.json','utf8')).name;
const vehicle=name==='motorfolio';const base=`http://127.0.0.1:${vehicle?5181:5182}`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
await context.addInitScript({path:'node_modules/axe-core/axe.min.js'});
const page=await context.newPage();const evidence=[];const errors=[];
page.on('pageerror',error=>errors.push(error.message));
mkdirSync('qa',{recursive:true});
async function check(name,work){await work();evidence.push({name,result:'pass'});}
try{
  await page.goto(base,{waitUntil:'networkidle'});
  if(vehicle){
    await check('first-run vehicle creation and durable relaunch',async()=>{
      await page.getByRole('button',{name:'Add your first vehicle'}).click();
      await page.getByLabel('Nickname',{exact:true}).fill('Browser QA vehicle');
      await page.getByLabel('Make',{exact:true}).fill('Honda');await page.getByLabel('Model',{exact:true}).fill('Fit');
      await page.getByRole('button',{name:'Save record'}).click();
      await page.getByRole('button',{name:'Log activity',exact:true}).waitFor();
      await page.reload({waitUntil:'networkidle'});await page.getByLabel('Selected vehicle',{exact:true}).waitFor();
      assert.equal(await page.getByLabel('Selected vehicle').inputValue().then(Boolean),true);
    });
    await check('real fuel save, edit, filtering and deletion confirmation',async()=>{
      await page.getByRole('button',{name:'Log activity',exact:true}).click();
      await page.getByLabel('Description',{exact:true}).fill('Browser QA fill');
      await page.getByLabel('Quantity (gal)',{exact:true}).fill('10');
      await page.getByLabel('Total cost',{exact:true}).fill('35');
      await page.getByRole('button',{name:'Save record'}).click();await page.getByText('Browser QA fill',{exact:true}).waitFor();
      await page.getByRole('link',{name:'Fuel & expenses',exact:true}).click();
      await page.getByRole('button',{name:'Edit Browser QA fill',exact:true}).click();
      await page.getByLabel('Description',{exact:true}).fill('Edited QA fill');
      await page.getByRole('button',{name:'Save record'}).click();
      await page.getByRole('textbox',{name:'Search activity',exact:true}).fill('Edited QA');
      await page.getByText('Edited QA fill',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Delete Edited QA fill',exact:true}).click();
      await page.getByRole('button',{name:'Confirm change',exact:true}).click();
      await page.getByText('No records here yet',{exact:true}).waitFor();
    });
    await check('complete maintenance reminder',async()=>{
      await page.getByRole('link',{name:'Maintenance',exact:true}).click();
      await page.getByRole('button',{name:'Add reminder',exact:true}).first().click();
      await page.getByLabel('Service / reminder',{exact:true}).fill('QA tire inspection');
      await page.getByRole('button',{name:'Save record'}).click();
      await page.getByRole('button',{name:'Complete',exact:true}).click();
      await page.getByRole('button',{name:'Reopen',exact:true}).waitFor();
    });
    await check('encrypted backup download',async()=>{
      await page.getByRole('link',{name:'Settings & data',exact:true}).click();
      await page.getByRole('button',{name:'Encrypted backup',exact:true}).click();
      await page.getByLabel('Backup password (at least 10 characters)',{exact:true}).fill('Browser QA password');
      const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Encrypt & download',exact:true}).click();
      assert.equal((await downloaded).suggestedFilename(),'Motorfolio-encrypted.backup');
    });
    await check('labeled demo visuals',async()=>{
      await page.getByRole('button',{name:'Delete all local data',exact:true}).click();
      await page.getByRole('button',{name:'Confirm change',exact:true}).click();
      await page.getByRole('link',{name:'Overview',exact:true}).click();
      await page.getByRole('button',{name:/Explore a clearly labeled demo garage/}).click();
      await page.getByText('Demo garage.',{exact:true}).waitFor();
    });
  }else{
    await check('actual companion status',async()=>{await page.getByText('Connection details',{exact:true}).waitFor();});
    await check('real ICMP test and persisted history',async()=>{
      await page.getByRole('link',{name:'Diagnostics',exact:true}).click();
      await page.getByLabel('Hostname or IPv4 address',{exact:true}).fill('127.0.0.1');
      await page.getByRole('button',{name:'Run diagnostic',exact:true}).click();
      await page.getByText('Round-trip latency',{exact:true}).waitFor({timeout:30000});
      await page.getByRole('link',{name:'Test history',exact:true}).click();
      await page.getByRole('button',{name:'View results',exact:false}).waitFor();
      await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'View results',exact:false}).waitFor();
    });
    await page.getByRole('link',{name:'Overview',exact:true}).click();
  }
  await check('desktop screenshot and semantic accessibility',async()=>{
    await page.screenshot({path:'qa/desktop.png',fullPage:true});
    const result=await page.evaluate(async()=>globalThis.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
    writeFileSync('qa/accessibility.json',JSON.stringify(result.violations,null,2));
    assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
  });
  await check('320px responsive layout',async()=>{
    await page.setViewportSize({width:320,height:900});await page.screenshot({path:'qa/mobile-320.png',fullPage:true});
    const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(size.scroll<=size.width,JSON.stringify(size));
  });
  await check('dark theme',async()=>{
    await page.setViewportSize({width:1440,height:1050});
    await page.getByRole('button',{name:'Dark appearance',exact:true}).click();
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    await page.screenshot({path:'qa/dark.png',fullPage:true});
    const dark=await page.evaluate(async()=>globalThis.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
    writeFileSync('qa/accessibility-dark.json',JSON.stringify(dark.violations,null,2));
    assert.equal(dark.violations.length,0,JSON.stringify(dark.violations.map(v=>v.id)));
  });
  if(vehicle)await check('offline cached garage',async()=>{
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
    await page.getByText('Demo garage.',{exact:true}).waitFor();await context.setOffline(false);
  });
  assert.deepEqual(errors,[]);
}finally{
  writeFileSync('qa/browser-check.json',JSON.stringify({at:new Date().toISOString(),evidence,pageErrors:errors},null,2));
  await browser.close();
}
process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
