/* eslint-disable @typescript-eslint/no-require-imports -- Offline local configuration CLI. */
require('./offline-network-guard.cjs');
require('./register-typescript.cjs');
require('@next/env').loadEnvConfig(require('node:path').resolve(__dirname,'..'));
const {getOfflineLlmStatus}=require('../src/lib/aws/bedrock-config.ts');
const report=getOfflineLlmStatus();
console.log(JSON.stringify(report,null,2));
if(!report.configValid) process.exitCode=1;
