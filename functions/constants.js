export const COUNTERS_PATH = 'counters';

export const DISTRIBUTED_COLLECTION_NAME = 'distributed';
export const DISTRIBUTED_COUNTER_COUNT_PROPERTY = 'count';
export const DISTRIBUTED_COUNTER_NAME = 'distCount';
export const DISTRIBUTED_COUNT_INCREASE = 1;
export const DISTRIBUTED_MAX_RETRIES = 20;
export const DISTRIBUTED_NUMBER_OF_SHARDS = 50;
export const DISTRIBUTED_SHARDS_COLLECTION_NAME = 'shards';

export const DISTPUBSUB_COLLECTION_NAME = 'distPubSub';
export const DISTPUBSUB_COUNTER_COUNT_PROPERTY = 'count';
export const DISTPUBSUB_COUNTER_NAME = 'distPubSubCount';
export const DISTPUBSUB_COUNT_INCREASE = DISTRIBUTED_COUNT_INCREASE;
export const DISTPUBSUB_MAX_RETRIES = DISTRIBUTED_MAX_RETRIES;
export const DISTPUBSUB_NUMBER_OF_SHARDS = DISTRIBUTED_NUMBER_OF_SHARDS;
export const DISTPUBSUB_SHARDS_COLLECTION_NAME = 'shards';
export const DISTPUBSUB_TOPIC = 'distPubSub_topic';
export const DISTPUBSUB_TOPIC_SUBSCRIPTION = 'distPubSub_topic_sub';

export const DOCUMENT_BATCH_DATE_PROPERTY = 'batchDate';
export const DOCUMENT_DATA_PROPERTY = 'data';
export const DOCUMENT_DOC_NUMBER_SET_PROPERTY = 'docNumberSet';
export const DOCUMENT_LOOP_INDEX_PROPERTY = 'loopIndex';
export const DOCUMENT_NUM_PROPERTY = 'docNumber';

export const REQ_BODY_BATCHSIZE = 'batchSize';

export const TRADITIONAL_COLLECTION_NAME = 'traditional';
export const TRADITIONAL_COUNTER_COUNT_PROPERTY = 'count';
export const TRADITIONAL_COUNTER_INITIAL_VALUE = 1;
export const TRADITIONAL_COUNTER_NAME = 'tradCount';

export const randomString = (len = 1) => {
  const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ';
  let randomString = '';
  for (let i = 0; i < len; i++) {
    const randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
};

export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export const createDoc = async (
  fsDB,
  collectionName,
  loopNum,
  startTimeMillis
) => {
  const randLength = Math.floor(Math.random() * 40) + 1;
  const randSleep = Math.floor(Math.random() * 3000);

  const d = randomString(randLength);

  console.log(
    `createDoc(${loopNum}, ${startTimeMillis}, data:(${d}))` +
      ` -- sleep(${randSleep})`
  );

  await sleep(randSleep);
  fsDB.collection(collectionName).add({
    [DOCUMENT_DATA_PROPERTY]: d,
    [DOCUMENT_LOOP_INDEX_PROPERTY]: loopNum,
    [DOCUMENT_BATCH_DATE_PROPERTY]: startTimeMillis,
    // enables us to find docs without a docNumber set
    [DOCUMENT_DOC_NUMBER_SET_PROPERTY]: false,
  });
};

export const createBatchOfDocs = async (collectionName, req, res, admin) => {
  const startTimeMillis = new Date().getTime();

  const batchParam = Number(req.body[REQ_BODY_BATCHSIZE]);

  if (!batchParam || batchParam <= 0) {
    const err = `Invalid batch param value: (${req.body.batchSize})`;
    console.error(err);
    res.status(400).send(err);
  }
  console.log(
    'createBatchOfDocs(): ' +
      `batch size: (${batchParam}) -- collection(${collectionName})`
  );

  const msg = {};
  const fsDB = admin.firestore();

  try {
    console.log('START');
    const promises = [];
    for (let i = 0; i < batchParam; i++) {
      promises.push(createDoc(fsDB, collectionName, i, startTimeMillis));
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
};
