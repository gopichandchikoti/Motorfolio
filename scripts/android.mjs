import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const app=JSON.parse(readFileSync('package.json','utf8')).name;
const windows=process.platform==='win32';
function run(command,args,cwd=process.cwd()){
  const result=spawnSync(command,args,{cwd,stdio:'inherit',shell:windows,env:process.env});
  if(result.status!==0)process.exit(result.status??1);
}
const jdk=process.env.JAVA_HOME;
const sdk=process.env.ANDROID_HOME;
if(!jdk||!sdk)throw new Error('Set JAVA_HOME to JDK 21 and ANDROID_HOME to the Android SDK.');
writeFileSync('android/local.properties',`sdk.dir=${sdk.replaceAll('\\','\\\\')}\n`);
run(windows?'npm.cmd':'npm',['run','build']);
run(windows?'npx.cmd':'npx',['cap','sync','android']);
run(windows?'.\\gradlew.bat':'./gradlew',['assembleDebug','assembleRelease','--console=plain'],join(process.cwd(),'android'));
const apk='android/app/build/outputs/apk/debug/app-debug.apk';
if(!existsSync(apk)||readFileSync(apk).length<100000)throw new Error('APK missing or too small.');
mkdirSync('artifacts',{recursive:true});
const target=`artifacts/${app}-1.0.0-debug.apk`;copyFileSync(apk,target);
const sha256=createHash('sha256').update(readFileSync(target)).digest('hex');
writeFileSync(`${target}.sha256`,sha256+'\n');
const releaseSource='android/app/build/outputs/apk/release/app-release-unsigned.apk';
if(!existsSync(releaseSource))throw new Error('Unsigned release APK missing.');
const releaseTarget=`artifacts/${app}-1.0.0-release-unsigned.apk`;
copyFileSync(releaseSource,releaseTarget);
const releaseSha256=createHash('sha256').update(readFileSync(releaseTarget)).digest('hex');
writeFileSync(`${releaseTarget}.sha256`,releaseSha256+'\n');
writeFileSync('artifacts/build-evidence.json',JSON.stringify({app,versionName:'1.0.0',versionCode:1,
  path:target,sha256,size:readFileSync(target).length,builtAt:new Date().toISOString(),
  webIndexSha256:createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),
  release:{path:releaseTarget,sha256:releaseSha256,size:readFileSync(releaseTarget).length,signed:false},
  deviceInstall:'Build does not install. Run npm run test:android for emulator evidence; physical-phone acceptance is separate.'},null,2));
process.stdout.write(JSON.stringify({path:target,sha256})+'\n');
