const functions = require('firebase-functions');
const admin = require('firebase-admin');

const runtimeOpts = {
  memory: '1GB',
  timeoutSeconds: 300,
};

const BATCH_SIZE = 100;
const COLLECTION_NAME = 'traditional';
// const COUNTERS_PATH = 'counters';
// const COUNTER_NAME = 'tradCount';
// const COUNTER_COUNT_PROPERTY = 'count';
// const COUNTER_INITIAL_VALUE = 1;
// const DOCUMENT_NUM_PROPERTY = 'docNumber';
const DOCUMENT_DATA_PROPERTY = 'data';
const DOCUMENT_LOOP_INDEX_PROPERTY = 'loopIndex';
const DOCUMENT_BATCH_DATE_PROPERTY = 'batchDate';

const randomString = (len = 1) => {
  const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ';
  let randomString = '';
  for (let i = 0; i < len; i++) {
    const randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
};

const createDoc = async (fsDB, loopNum, fsStartTimestamp) => {
  const randLength = Math.floor(Math.random() * 40);

  const randSleep = Math.floor(Math.random() * 3000);
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  await sleep(randSleep);
  fsDB.collection(COLLECTION_NAME).add({
    [DOCUMENT_DATA_PROPERTY]: randomString(randLength),
    [DOCUMENT_LOOP_INDEX_PROPERTY]: loopNum,
    [DOCUMENT_BATCH_DATE_PROPERTY]: fsStartTimestamp,
  });
};

export default functions
  .runWith(runtimeOpts)
  .https.onRequest(async (req, res) => {
    const startTime = new Date();
    const fsStartTimestamp = admin.firestore.Timestamp.fromDate(startTime);
    const msg = {};
    const fsDB = admin.firestore();

    try {
      console.log('START');

      for (let i = 0; i < BATCH_SIZE; i++) {
        createDoc(fsDB, i, fsStartTimestamp);
      }

      console.log('END');
    } catch (ex) {
      console.error(`main body:: ${ex.message}`);
    }

    msg.runTimeInSecs = new Date().getTime() - startTime.getTime();
    res.send(msg);
  });
