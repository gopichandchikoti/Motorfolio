import {chromium} from 'playwright-core';
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const name=JSON.parse(readFileSync('package.json','utf8')).name;
assert.ok(['motorfolio','wavescope'].includes(name));
const appId=`com.portfolio.${name}`;
const vehicle=name==='motorfolio';
const serial=process.env.ANDROID_SERIAL;
if(!serial?.startsWith('emulator-'))throw new Error('Set ANDROID_SERIAL to a dedicated test emulator.');
const sdk=process.env.ANDROID_HOME||'C:/Users/chand/Documents/Codex/android-sdk';
const adb=join(sdk,'platform-tools',process.platform==='win32'?'adb.exe':'adb');
const port=vehicle?19581:19582;
const evidence=[];
const cleanupErrors=[];
let forwarded=false;
let failure;
const runId=Date.now();
mkdirSync('qa',{recursive:true});
function android(args,binary=false){
  const result=spawnSync(adb,['-s',serial,...args],{encoding:binary?undefined:'utf8',timeout:60000,windowsHide:true});
  if(result.status!==0)throw new Error(`adb ${args[0]} failed: ${String(result.stderr)}`);
  return result.stdout;
}
async function until(work,timeout=20000){
  const start=Date.now();let last;
  while(Date.now()-start<timeout){
    try{const value=await work();if(value)return value;}catch(error){last=error;}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`Android did not become ready: ${String(last??'timed out')}`);
}
async function launch(){
  android(['shell','am','start','-W','-n',`${appId}/.MainActivity`]);
  await until(()=>String(android(['shell','dumpsys','window'])).split('\n')
    .find(line=>line.includes('mCurrentFocus='))?.includes(appId));
  const pid=await until(()=>String(android(['shell','pidof',appId])).trim());
  android(['forward',`tcp:${port}`,`localabstract:webview_devtools_remote_${pid.split(' ')[0]}`]);
  forwarded=true;
  await until(async()=>{const r=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(1000)});return r.ok;});
  const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{noDefaults:true});
  const page=await until(()=>browser.contexts()[0]?.pages()[0]);
  await page.waitForURL(/https?:\/\/localhost/,{timeout:20000});
  assert.equal(await page.evaluate(()=>window.Capacitor.isNativePlatform()),true);
  return {browser,page};
}
async function check(title,work){await work();evidence.push({title,result:'pass'});}
async function database(){
  const bytes=android(['exec-out','run-as',appId,'cat','databases/workspace.db'],true);
  const path=resolve('qa/android-workspace.sqlite');writeFileSync(path,bytes);
  const db=new DatabaseSync(path,{readOnly:true});
  try{const row=db.prepare('SELECT revision,json FROM snapshot WHERE id=1').get();assert.ok(row);
    return {revision:row.revision,...JSON.parse(row.json)};}finally{db.close();}
}
let browser;let page;
try{
  await check('install actual debug APK on dedicated Android API 35 emulator',async()=>{
    const result=android(['install','-r',resolve(`artifacts/${name}-1.0.0-debug.apk`)]);
    assert.match(String(result),/Success/);
  });
  if(vehicle){
    android(['shell','pm','revoke',appId,'android.permission.POST_NOTIFICATIONS']);
    android(['shell','pm','set-permission-flags',appId,'android.permission.POST_NOTIFICATIONS','user-set','user-fixed']);
  }
  ({browser,page}=await launch());
  await check('native app launch and real SQLite adapter initialization',async()=>{
    await page.getByRole('heading',{name:vehicle?'Good to go, mile after mile.':'A little clarity in the air.'}).waitFor();
    await page.waitForFunction(()=>!document.body.textContent.includes('Opening your'));
    assert.equal(await page.getByRole('alert').count(),0);
  });
  let record;
  if(vehicle){
    const nickname=`Android QA ${runId}`;
    await check('vehicle and fuel save through native SQLite',async()=>{
      if(await page.getByRole('button',{name:'Add your first vehicle',exact:true}).count()){
        await page.getByRole('button',{name:'Add your first vehicle',exact:true}).click();
      }else{await page.getByRole('link',{name:'My garage',exact:true}).click();await page.getByRole('button',{name:'Add vehicle',exact:true}).click();}
      await page.getByLabel('Nickname',{exact:true}).fill(nickname);
      await page.getByLabel('Make',{exact:true}).fill('Honda');await page.getByLabel('Model',{exact:true}).fill('Fit');
      await page.getByRole('button',{name:'Save record',exact:true}).click();
      await page.getByRole('link',{name:'Overview',exact:true}).click();
      const selected=page.getByLabel('Selected vehicle',{exact:true});await selected.selectOption({label:nickname});
      await page.getByRole('button',{name:'Log activity',exact:true}).click();
      await page.getByLabel('Description',{exact:true}).fill('Native SQLite QA fill');
      await page.getByLabel('Quantity (gal)',{exact:true}).fill('10');
      await page.getByLabel('Total cost',{exact:true}).fill('40');
      await page.getByRole('button',{name:'Save record',exact:true}).click();
      await page.getByText('Native SQLite QA fill',{exact:true}).first().waitFor();
      record=await database();assert.ok(record.value.vehicles.some(item=>item.name===nickname));
      assert.ok(record.value.entries.some(item=>item.title==='Native SQLite QA fill'));assert.ok(record.revision>=2);
    });
    await check('structured warranty and imported receipt persist in native SQLite',async()=>{
      await page.getByRole('link',{name:'Warranties',exact:true}).click();
      await page.getByRole('button',{name:'Add warranty',exact:true}).click();
      await page.getByLabel('Coverage name',{exact:true}).fill(`Native warranty ${runId}`);
      await page.getByLabel('Provider',{exact:true}).fill('QA fixture supplier');
      await page.getByLabel('Coverage ends (optional)',{exact:true}).fill('2099-01-01');
      await page.getByLabel('Warranty receipt (image or PDF, up to 3 MB)',{exact:true}).setInputFiles({
        name:'native-fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nQA fixture')});
      await page.getByRole('button',{name:'Save record',exact:true}).click();
      await page.getByText(`Native warranty ${runId}`,{exact:true}).waitFor();
      const saved=await database();assert.equal(saved.value.version,2);
      assert.ok(saved.value.warranties.some(item=>item.title===`Native warranty ${runId}`&&item.receipt.startsWith('data:application/pdf')));
    });
    await check('denied Android notification permission leaves records and in-app reminders usable',async()=>{
      await page.getByRole('link',{name:'Settings & data',exact:true}).click();
      await page.getByRole('button',{name:'Enable date notifications',exact:true}).click();
      await page.getByText(/Notifications were not allowed/).waitFor();
      assert.ok((await database()).value.warranties.length>0);
      android(['shell','pm','clear-permission-flags',appId,'android.permission.POST_NOTIFICATIONS','user-set','user-fixed']);
      android(['shell','pm','grant',appId,'android.permission.POST_NOTIFICATIONS']);
      await page.getByRole('button',{name:'Enable date notifications',exact:true}).click();
      await page.getByRole('button',{name:'Disable notifications',exact:true}).waitFor();
      const pending=await page.evaluate(()=>window.Capacitor.Plugins.LocalNotifications.getPending());
      assert.ok(pending.notifications.length>0);
    });
    await check('Android delivers an actual notification with granted permission',async()=>{
      await page.evaluate(async()=>{
        await window.Capacitor.Plugins.LocalNotifications.schedule({notifications:[{
          id:777777,title:'Motorfolio QA delivery',body:'Dedicated emulator test',schedule:{at:new Date(Date.now()+3000)}}]});
      });
      await until(()=>String(android(['shell','dumpsys','notification','--noredact'])).includes('Motorfolio QA delivery'),30000);
      await page.evaluate(()=>window.Capacitor.Plugins.LocalNotifications.removeDeliveredNotifications({notifications:[{id:777777}]}));
    });
    await check('airplane-mode native records remain editable and durable',async()=>{
      const previous=String(android(['shell','settings','get','global','airplane_mode_on'])).trim();
      try{
        android(['shell','cmd','connectivity','airplane-mode','enable']);
        await page.getByRole('link',{name:'Warranties',exact:true}).click();
        await page.getByRole('button',{name:`Edit warranty Native warranty ${runId}`,exact:true}).click();
        await page.getByLabel('Coverage terms / exclusions (optional)',{exact:true}).fill(`Saved in airplane mode ${runId}`);
        await page.getByRole('button',{name:'Save record',exact:true}).click();
        await page.getByText(`Saved in airplane mode ${runId}`,{exact:true}).waitFor();
        assert.ok((await database()).value.warranties.some(item=>item.notes===`Saved in airplane mode ${runId}`));
      }finally{android(['shell','cmd','connectivity','airplane-mode',previous==='1'?'enable':'disable']);}
    });
    await check('actual emulator camera photo is attached and saved in native SQLite',async()=>{
      await page.getByRole('button',{name:'Add warranty',exact:true}).click();
      await page.getByLabel('Coverage name',{exact:true}).fill(`Camera warranty ${runId}`);
      await page.getByLabel('Provider',{exact:true}).fill('Emulated camera fixture');
      await page.getByRole('button',{name:'Capture receipt photo',exact:true}).click();
      await until(()=>String(android(['shell','dumpsys','window'])).split('\n')
        .find(line=>line.includes('mCurrentFocus='))?.includes('com.android.camera2'));
      android(['shell','input','keyevent','27']);
      const bounds=await until(()=>{
        android(['shell','uiautomator','dump','--compressed','/sdcard/motorfolio-camera.xml']);
        const xml=String(android(['shell','cat','/sdcard/motorfolio-camera.xml']));
        return xml.match(/resource-id="com.android.camera2:id\/done_button"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      },45000);
      android(['shell','input','tap',String(Math.round((Number(bounds[1])+Number(bounds[3]))/2)),
        String(Math.round((Number(bounds[2])+Number(bounds[4]))/2))]);
      await page.getByRole('dialog').getByText(/receipt-photo-.*\.jpg/).waitFor({timeout:30000});
      await page.getByRole('button',{name:'Save record',exact:true}).click();
      await page.getByText(`Camera warranty ${runId}`,{exact:true}).waitFor();
      const saved=await database();
      assert.ok(saved.value.warranties.some(item=>item.title===`Camera warranty ${runId}`&&item.receipt.startsWith('data:image/jpeg')));
    });
    await check('Android system back closes the record dialog and keeps the app usable',async()=>{
      await page.getByRole('button',{name:'Add warranty',exact:true}).click();
      await page.getByRole('dialog').waitFor();
      android(['shell','input','keyevent','4']);
      await page.getByRole('dialog').waitFor({state:'hidden',timeout:5000});
      await page.getByRole('link',{name:'Settings & data',exact:true}).click();
    });
    await check('native encrypted backup reaches Android share sheet without sending',async()=>{
      await page.getByRole('link',{name:'Settings & data',exact:true}).click();
      await page.getByRole('button',{name:'Encrypted backup',exact:true}).click();
      await page.getByLabel('Backup password (at least 10 characters)',{exact:true}).fill('emulator-only-test-password');
      await page.getByRole('button',{name:'Encrypt & download',exact:true}).click();
      await until(()=>String(android(['shell','dumpsys','activity','activities'])).includes('ChooserActivity'));
      const raw=String(android(['exec-out','run-as',appId,'cat','cache/exports/Motorfolio-encrypted.backup']));
      assert.equal(JSON.parse(raw).format,'motorfolio-aes256-v1');assert.ok(!raw.includes(nickname));
      android(['shell','input','keyevent','4']);
    });
  }else{
    await check('Android connection capabilities remain usable without location grant',async()=>{
      await page.getByText('Connection details',{exact:true}).waitFor();
      await page.getByText(/Source: Android ConnectivityManager/).waitFor();
      assert.equal(await page.getByRole('alert').count(),0);
    });
    await check('actual Android ICMP probes and native history save',async()=>{
      await page.getByRole('link',{name:'Diagnostics',exact:true}).click();
      await page.getByLabel('Hostname or IPv4 address',{exact:true}).fill('127.0.0.1');
      await page.getByRole('button',{name:'Run diagnostic',exact:true}).click();
      await page.getByText('Round-trip latency',{exact:true}).waitFor({timeout:30000});
      record=await database();const item=record.value.history[0];assert.equal(item.host,'127.0.0.1');
      assert.equal(item.source,'Android OS');assert.equal(item.samples.length,4);assert.ok(item.samples.every(value=>typeof value==='number'));
    });
  }
  await browser.close();browser=undefined;
  android(['shell','am','force-stop',appId]);
  ({browser,page}=await launch());
  await check('force-stop/relaunch preserves real SQLite records',async()=>{
    if(vehicle){await page.getByLabel('Selected vehicle',{exact:true}).waitFor();
      const saved=await database();assert.equal(saved.value.vehicles.length,record.value.vehicles.length);
      assert.ok(saved.value.entries.some(item=>item.title==='Native SQLite QA fill'));
    }else{await page.getByRole('link',{name:'Test history',exact:true}).click();
      await page.getByRole('button',{name:'View results',exact:false}).first().waitFor();
      const saved=await database();assert.equal(saved.value.history[0].id,record.value.history[0].id);}
  });
  if(vehicle){
    await check('Android 150 percent text scale and landscape preserve usable navigation',async()=>{
      const originalFont=String(android(['shell','settings','get','system','font_scale'])).trim();
      const originalRotation=String(android(['shell','settings','get','system','user_rotation'])).trim();
      const originalAuto=String(android(['shell','settings','get','system','accelerometer_rotation'])).trim();
      await browser.close();browser=undefined;
      try{
        android(['shell','settings','put','system','font_scale','1.5']);
        android(['shell','settings','put','system','accelerometer_rotation','0']);
        android(['shell','settings','put','system','user_rotation','1']);
        android(['shell','am','force-stop',appId]);
        ({browser,page}=await launch());
        await page.getByRole('link',{name:'Warranties',exact:true}).click();
        await page.getByRole('button',{name:'Add warranty',exact:true}).click();
        await page.getByRole('button',{name:'Cancel',exact:true}).click();
        const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth}));
        assert.ok(size.width>size.height,JSON.stringify(size));assert.ok(size.scroll<=size.width,JSON.stringify(size));
        await page.screenshot({path:'qa/android-landscape-large-text.png'});
      }finally{
        if(browser){await browser.close();browser=undefined;}
        android(['shell','settings','put','system','font_scale',originalFont==='null'?'1.0':originalFont]);
        android(['shell','settings','put','system','user_rotation',originalRotation==='null'?'0':originalRotation]);
        android(['shell','settings','put','system','accelerometer_rotation',originalAuto==='null'?'0':originalAuto]);
        android(['shell','am','force-stop',appId]);
        ({browser,page}=await launch());
      }
    });
  }
  await check('capture actual emulator screenshot and confirm responsive document',async()=>{
    const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.width,JSON.stringify(dimensions));
    await page.waitForFunction(()=>!document.body.textContent.includes('Opening your'));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:'qa/android-webview.png'});
    android(['shell','input','keyevent','3']);
    android(['shell','am','start','-W','-n',`${appId}/.MainActivity`]);
    await until(()=>String(android(['shell','dumpsys','window'])).split('\n')
      .find(line=>line.includes('mCurrentFocus='))?.includes(appId));
    await page.waitForFunction(()=>!document.body.textContent.includes('Opening your'));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    writeFileSync('qa/android-api35.png',android(['exec-out','screencap','-p'],true));
  });
}catch(error){failure=String(error);throw error;}finally{
  if(browser)await browser.close().catch(error=>cleanupErrors.push(String(error)));
  try{android(['shell','am','force-stop',appId]);}catch(error){cleanupErrors.push(String(error));}
  if(forwarded){try{android(['forward','--remove',`tcp:${port}`]);}catch(error){cleanupErrors.push(String(error));}}
  writeFileSync('qa/android-check.json',JSON.stringify({at:new Date().toISOString(),serial,
    sdk:String(android(['shell','getprop','ro.build.version.sdk'])).trim(),
    model:String(android(['shell','getprop','ro.product.model'])).trim(),physicalDevice:false,apkSha256:createHash('sha256').update(readFileSync(`artifacts/${name}-1.0.0-debug.apk`)).digest('hex'),evidence,failure,cleanupErrors},null,2));
}
process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
