'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const product = require('../../../product.json');

const inheritedWindowsIds = new Set([
  '{{D77B7E06-80BA-4137-BCF4-654B95CCEBC5}',
  '{{D1ACE434-89C5-48D1-88D3-E2991DF85475}',
  '{{CC6B787D-37A0-49E8-AE24-8559A032BE0C}',
  '{{3AEBF0C8-F733-4AD4-BADE-FDB816D53D7B}'
]);
const windowsIdFields = ['win32x64AppId','win32arm64AppId','win32x64UserAppId','win32arm64UserAppId'];
const UUID_RE = /^\{\{[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\}$/i;

test('QuantumATi is the customer-facing desktop identity', () => {
  assert.equal(product.nameShort, 'QuantumATi');
  assert.equal(product.nameLong, 'QuantumATi Studio');
  assert.equal(product.applicationName, 'quantumati');
  assert.equal(product.win32DirName, 'QuantumATi Studio');
  assert.equal(product.win32NameVersion, 'QuantumATi Studio');
});

test('QuantumATi uses independent storage, scheme, and process identities', () => {
  assert.equal(product.dataFolderName, '.quantumati');
  assert.equal(product.serverDataFolderName, '.quantumati-server');
  assert.equal(product.urlProtocol, 'quantumati');
  assert.equal(product.win32MutexName, 'quantumati-studio');
  assert.equal(product.win32AppUserModelId, 'QuantumATi.Studio');
  assert.equal(product.darwinBundleIdentifier, 'de.lordenryque.quantumati');
});

test('Windows install IDs are distinct from upstream and from each other', () => {
  const ids = windowsIdFields.map(key => {
    const id = product[key];
    assert.match(id, UUID_RE, key + ' needs a distinct packaging UUID');
    assert.ok(!inheritedWindowsIds.has(id), key + ' must not reuse Code-OSS ID');
    return id;
  });
  assert.equal(new Set(ids).size, ids.length);
});

test('macOS management IDs no longer reuse upstream values', () => {
  assert.notEqual(product.darwinProfileUUID, '47827DD9-4734-49A0-AF80-7E19B11495CC');
  assert.notEqual(product.darwinProfilePayloadUUID, 'CF808BE7-53F3-46C6-A7E2-7EDB98A5E959');
  assert.notEqual(product.darwinProfileUUID, product.darwinProfilePayloadUUID);
});

test('upstream licenses remain intact and issues go to owner repository', () => {
  assert.equal(product.licenseName, 'MIT');
  assert.equal(product.licenseUrl, 'https://github.com/microsoft/vscode/blob/main/LICENSE.txt');
  assert.equal(product.licenseFileName, 'LICENSE.txt');
  assert.equal(product.reportIssueUrl, 'https://github.com/LOrdEnRYQuE/atiq-editor-core/issues/new');
});
