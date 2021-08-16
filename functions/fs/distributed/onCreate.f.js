const functions = require('firebase-functions');
const admin = require('firebase-admin');

const CONSTS = require('../../constants');

const db = admin.firestore();
const logger = functions.logger;

const MAX_RETRIES = 4;

const createCounter = (ref, numShards) => {
  const batch = db.batch();

  // Initialize the counter document
  batch.set(ref, { num_shards: numShards });

  // Initialize each shard with count=0
  for (let i = 0; i < numShards; i++) {
    const shardRef = db
      .collection(CONSTS.COUNTERS_PATH)
      .doc(CONSTS.DISTRIBUTED_COUNTER_NAME)
      .collection(CONSTS.DISTRIBUTED_SHARDS_COLLECTION_NAME)
      .doc(i.toString());
    batch.set(shardRef, { count: 0 });
  }

  // Commit the write batch
  return batch.commit();
};

const incrementCounter = (transaction, ref, numShards) => {
  // Select a shard of the counter at random
  const shardId = Math.floor(Math.random() * numShards).toString();
  const shardRef = ref
    .collection(CONSTS.DISTRIBUTED_SHARDS_COLLECTION_NAME)
    .doc(shardId); // ref

  console.log(`UPDATING shard#(${shardId})`);
  // Update count
  transaction.update(shardRef, {
    [CONSTS.DISTRIBUTED_COUNTER_COUNT_PROPERTY]:
      admin.firestore.FieldValue.increment(CONSTS.DISTRIBUTED_COUNT_INCREASE),
  });
};

const getCount = (transaction, ref) => {
  // Sum the count of each shard in the subcollection
  const shardsRef = ref.collection(CONSTS.DISTRIBUTED_SHARDS_COLLECTION_NAME);
  console.log(`getCount(): shardsRef path is: (${shardsRef.path})`);
  return transaction.get(shardsRef).then((snapshot) => {
    let totalCount = 0;
    snapshot.forEach((doc) => {
      totalCount += doc.data().count;
    });

    return totalCount + CONSTS.DISTRIBUTED_COUNT_INCREASE;
  });
};

export const ensureCounterExists = () => {
  const counterRef = db
    .collection(CONSTS.COUNTERS_PATH)
    .doc(CONSTS.DISTRIBUTED_COUNTER_NAME);
  return counterRef.get().then((docSnap) => {
    if (!docSnap.exists) {
      logger.warn(
        `${CONSTS.DISTRIBUTED_COUNTER_NAME} metadata not found: ` +
          `(${CONSTS.COUNTERS_PATH}) -- CREATING IT NOW`
      );
      createCounter(counterRef, CONSTS.DISTRIBUTED_NUMBER_OF_SHARDS);
    }
  });
};

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const tryFsTransaction = async (snap, retryCount) => {
  return db.runTransaction(async (transaction) => {
    const origDocRef = snap.ref;

    console.log(`docId(${origDocRef.id}) -- start RETRY_COUNT#(${retryCount})`);
    // Get the metadata document and increment the count.
    const newCounterRef = db
      .collection(CONSTS.COUNTERS_PATH)
      .doc(CONSTS.DISTRIBUTED_COUNTER_NAME);
    // const metaRef = db.collection(path);
    const number = await getCount(transaction, newCounterRef);
    incrementCounter(
      transaction,
      newCounterRef,
      CONSTS.DISTRIBUTED_NUMBER_OF_SHARDS
    );

    transaction.update(origDocRef, {
      [CONSTS.DOCUMENT_NUM_PROPERTY]: number,
      [CONSTS.DOCUMENT_DOC_NUMBER_SET_PROPERTY]: true,
    });

    console.log(`SUCCESS! docId(${origDocRef.id}) -- number: ${number}`);
    return number;
  });
};

const callWithRetry = async (fn, snap, retryCount = 0) => {
  try {
    return await fn(snap, retryCount);
  } catch (e) {
    console.log(`callWithRetry(): EXCEPTION: ${e.message}`);

    if (retryCount > MAX_RETRIES) {
      console.error(
        `MAX_RETRIES (${retryCount} > ${MAX_RETRIES}) ` +
          `exceeded!: ${e.message}`
      );
      throw e;
    }

    // random 1000 to 2000 value
    const waitTime = 2 ** retryCount * Math.floor(Math.random() * 1000) + 1000;

    // max wait it (2 ^ MAX_RETRIES) * 2000 = 2 ^ 4 * 2000 ms = 32s
    await wait(waitTime); // exponential backoff

    console.log(
      `callWithRetry(): about to retry for ${snap.id} ` +
        `-- retryCount (${retryCount}) -- waitTime(${waitTime})`
    );
    return callWithRetry(fn, snap, retryCount + 1);
  }
};

// Cloud Function to increment the document field after creation.
export default functions
  .runWith({ timeoutSeconds: 300 })
  .firestore.document(`${CONSTS.DISTRIBUTED_COLLECTION_NAME}/{docId}`)
  .onCreate((snap, context) => {
    return ensureCounterExists().then(() => {
      return callWithRetry(tryFsTransaction, snap);
    });
  });
