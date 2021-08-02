const loadFunctions = require('firebase-function-tools');
const admin = require('firebase-admin');
// `const functions = require('firebase-functions');
// const config = functions.config();

admin.initializeApp();

loadFunctions(__dirname, exports);
console.log('GLF: Cloud Functions LOADED');
