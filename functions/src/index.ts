// tslint:disable-next-line: no-import-side-effect
import 'source-map-support/register'
import { config } from 'firebase-functions';

const admin = require('firebase-admin');
admin.initializeApp(config().firebase);

// API

// // Add to collection
// import { storeApp } from './api/store';
// export const store = https.onRequest(storeApp)

// // Retrieve proof 
// import { proveApp } from './api/prove';
// export const prove = https.onRequest(proveApp);

// // Download file
// import { downloadApp } from './api/download';
// export const download = https.onRequest(downloadApp);

// // Process item collections and make a merkle tree
// import { work } from './workers/metaverse-testnet';
// export const mvsWorker = pubsub.schedule('every 3 minutes')
//     .timeZone('America/New_York')
//     .onRun(work);

const functions = require('firebase-functions')

import { storeApp } from './api/store';
exports.store = functions.region('us-central1').https.onRequest(storeApp);

import { proveApp } from './api/prove';
exports.prove = functions.region('us-central1').https.onRequest(proveApp);

import { downloadApp } from './api/download';
exports.download = functions.region('us-central1').https.onRequest(downloadApp);

import { work } from './workers/metaverse-testnet';
exports.mvsWorker = functions.region('us-central1').pubsub.schedule('every 3 minutes').timeZone('America/New_York').onRun(work);
