const functions = require('firebase-functions');
const admin = require('firebase-admin');

const CONSTS = require('../constants');

const runtimeOpts = {
  memory: '1GB',
  timeoutSeconds: 300,
};

const randomString = (len = 1) => {
  const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ';
  let randomString = '';
  for (let i = 0; i < len; i++) {
    const randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
};

const createDoc = async (fsDB, loopNum, startTimeMillis) => {
  const randLength = Math.floor(Math.random() * 40);

  const randSleep = Math.floor(Math.random() * 3000);
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const d = randomString(randLength);

  console.log(
    `createDoc(${loopNum}, ${startTimeMillis}, data:(${d}))` +
      ` -- sleep(${randSleep})`
  );

  await sleep(randSleep);
  fsDB.collection(CONSTS.TRADITIONAL_COLLECTION_NAME).add({
    [CONSTS.DOCUMENT_DATA_PROPERTY]: d,
    [CONSTS.DOCUMENT_LOOP_INDEX_PROPERTY]: loopNum,
    [CONSTS.DOCUMENT_BATCH_DATE_PROPERTY]: startTimeMillis,
  });
};

export default functions
  .runWith(runtimeOpts)
  .https.onRequest(async (req, res) => {
    const startTimeMillis = new Date().getTime();

    const batchParam = Number(req.body[CONSTS.REQ_BODY_BATCHSIZE]);

    if (!batchParam || batchParam <= 0) {
      const err = `Invalid batch param value: (${req.body.batchSize})`;
      console.error(err);
      res.status(400).send(err);
    }
    console.log(`batch size: (${batchParam})`);

    const msg = {};
    const fsDB = admin.firestore();

    try {
      console.log('START');
      const promises = [];
      for (let i = 0; i < batchParam; i++) {
        promises.push(createDoc(fsDB, i, startTimeMillis));
      }

      console.log('AWAITING PROMISES');
      await Promise.all(promises);
      console.log('END');
      msg.result = 'SUCCESS';
    } catch (ex) {
      console.error(`main body:: ${ex.message}`);
      msg.result = 'ERROR';
      msg.message = ex.message;
    }

    msg.runTimeInSecs = new Date().getTime() - startTimeMillis;
    res.send(msg);
  });
