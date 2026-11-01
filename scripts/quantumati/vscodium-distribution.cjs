'use strict';
const fs=require('node:fs');
const path=require('node:path');
const EXPECTED_GALLERY=Object.freeze({
 serviceUrl:'https://open-vsx.org/vscode/gallery',
 itemUrl:'https://open-vsx.org/vscode/item',
 latestUrlTemplate:'https://open-vsx.org/vscode/gallery/{publisher}/{name}/latest',
 controlUrl:'https://raw.githubusercontent.com/EclipseFdn/publish-extensions/refs/heads/master/extension-control/extensions.json'
});
function auditDistribution(input){
 const p=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const identity=p.nameShort==='QuantumATi'&&p.nameLong==='QuantumATi Studio'&&p.applicationName==='quantumati'&&p.dataFolderName==='.quantumati'&&p.urlProtocol==='quantumati'&&p.darwinBundleIdentifier==='de.lordenryque.quantumati'&&p.reportIssueUrl==='https://github.com/LOrdEnRYQuE/atiq-editor-core/issues/new';
 const g=p.extensionsGallery;
 const openVSX=!!(g&&typeof g==='object'&&!Array.isArray(g)&&Object.entries(EXPECTED_GALLERY).every(([k,v])=>g[k]===v)&&Array.isArray(p.linkProtectionTrustedDomains)&&p.linkProtectionTrustedDomains.includes('https://open-vsx.org'));
 const independentUpdates=!Object.hasOwn(p,'updateUrl')&&!Object.hasOwn(p,'downloadUrl');
 const license=p.licenseName==='MIT'&&p.licenseFileName==='LICENSE.txt';
 const checks=[
 {id:'identity',status:identity?'VALID':'INVALID',detail:'QuantumATi product namespace verified from static metadata.'},
 {id:'open_vsx_registry',status:openVSX?'VALID':'INVALID',detail:'Open VSX endpoints match reviewed VSCodium setup; extension runtime and license not verified.'},
 {id:'independent_updates',status:independentUpdates?'VALID':'INVALID',detail:'No inherited vendor download/update URLs. QuantumATi auto-updates are not configured.'},
 {id:'license',status:license?'VALID':'INVALID',detail:'License metadata only; bundled component licenses not audited.'},
 {id:'telemetry',status:'UNVERIFIED',detail:'Runtime network traffic and extension/provider telemetry require separate audit.'},
 {id:'desktop_runtime',status:'UNVERIFIED',detail:'Real OS startup, install, editing and extension browsing still need E2E proof.'}
 ];
 return {schemaVersion:1,scope:'STATIC_PRODUCT_CONFIGURATION',configuration:'VSCODIUM_STYLE_OPEN_VSX',configValid:!checks.some(x=>x.status==='INVALID'),releaseReady:false,checks};
}
function runCli(file){
 try{
 const filename=path.resolve(file||path.join(process.cwd(),'product.json'));
 const stat=fs.lstatSync(filename);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>128*1024)throw new Error('unsupported manifest');
 const result=auditDistribution(JSON.parse(fs.readFileSync(filename,'utf8')));
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
 if(!result.configValid)process.exitCode=1;
 }catch(_error){process.stderr.write('QuantumATi product manifest missing, unreadable or invalid JSON.\n');process.exitCode=1;}
}
if(require.main===module)runCli(process.argv[2]);
module.exports={EXPECTED_GALLERY,auditDistribution,runCli};
