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
    return CONSTS.createBatchOfDocs(
      CONSTS.DISTRIBUTED_COLLECTION_NAME,
      req,
      res,
      admin
    );
  });
