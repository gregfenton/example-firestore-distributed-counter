const functions = require('firebase-functions');
const admin = require('firebase-admin');

const CONSTS = require('../constants');

const runtimeOpts = {
  memory: '1GB',
  timeoutSeconds: 300,
};

export default functions
  .runWith(runtimeOpts)
  .https.onRequest(async (req, res) => {
    console.log('httpBatchCreateDistPubSub started');
    return CONSTS.createBatchOfDocs(
      CONSTS.DISTPUBSUB_COLLECTION_NAME,
      req,
      res,
      admin
    );
  });
