const functions = require('firebase-functions');
const admin = require('firebase-admin');

const CONSTS = require('../constants');

const db = admin.firestore();
const logger = functions.logger;

const createCounter = (ref, numShards) => {
  const batch = db.batch();

  // Initialize the counter document
  batch.set(ref, { num_shards: numShards });

  // Initialize each shard with count=0
  for (let i = 0; i < numShards; i++) {
    const shardRef = db
      .collection(CONSTS.COUNTERS_PATH)
      .doc(CONSTS.DISTPUBSUB_COUNTER_NAME)
      .collection(CONSTS.DISTPUBSUB_SHARDS_COLLECTION_NAME)
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
    .collection(CONSTS.DISTPUBSUB_SHARDS_COLLECTION_NAME)
    .doc(shardId); // ref

  console.log(`UPDATING shard#(${shardId})`);
  // Update count
  transaction.update(shardRef, {
    [CONSTS.DISTPUBSUB_COUNTER_COUNT_PROPERTY]:
      admin.firestore.FieldValue.increment(CONSTS.DISTPUBSUB_COUNT_INCREASE),
  });
};

const getCount = (transaction, ref) => {
  // Sum the count of each shard in the subcollection
  const shardsRef = ref.collection(CONSTS.DISTPUBSUB_SHARDS_COLLECTION_NAME);
  console.log(`getCount(): shardsRef path is: (${shardsRef.path})`);
  return transaction.get(shardsRef).then((snapshot) => {
    let totalCount = 0;
    snapshot.forEach((doc) => {
      totalCount += doc.data().count;
    });

    return totalCount + CONSTS.DISTPUBSUB_COUNT_INCREASE;
  });
};

export const ensureCounterExists = () => {
  const counterRef = db
    .collection(CONSTS.COUNTERS_PATH)
    .doc(CONSTS.DISTPUBSUB_COUNTER_NAME);
  return counterRef.get().then((docSnap) => {
    if (!docSnap.exists) {
      logger.warn(
        `${CONSTS.DISTPUBSUB_COUNTER_NAME} metadata not found: ` +
          `(${CONSTS.COUNTERS_PATH}) -- CREATING IT NOW`
      );
      createCounter(counterRef, CONSTS.DISTPUBSUB_NUMBER_OF_SHARDS);
    }
  });
};

const tryFsTransaction = async (docRef) => {
  return db.runTransaction(async (transaction) => {
    console.log(`Trying docId(${docRef.id})`);

    // Get the metadata document and increment the count.
    const newCounterRef = db
      .collection(CONSTS.COUNTERS_PATH)
      .doc(CONSTS.DISTPUBSUB_COUNTER_NAME);
    const number = await getCount(transaction, newCounterRef);
    incrementCounter(
      transaction,
      newCounterRef,
      CONSTS.DISTPUBSUB_NUMBER_OF_SHARDS
    );

    transaction.update(docRef, {
      [CONSTS.DOCUMENT_NUM_PROPERTY]: number,
      [CONSTS.DOCUMENT_DOC_NUMBER_SET_PROPERTY]: true,
    });

    return number;
  });
};

// Cloud Function to increment the document field after creation.
export default functions
  .runWith({ memory: '1GB', timeoutSeconds: 300 })
  .pubsub.topic(`${CONSTS.DISTPUBSUB_TOPIC}`)
  .onPublish((message, context) => {
    console.log(
      `PUBSUB - got new message!!! ${JSON.stringify(message, null, 2)}`
    );
    return ensureCounterExists().then(() => {
      const docId = message.json.docId;
      if (!docId) {
        console.error(
          `PUBSUB - MAIN message does not have docId! ${JSON.stringify(
            message
          )}`
        );
        throw new Error('PUBSUB - MAIN message does not have docId!');
      }

      const docRef = db
        .collection(`${CONSTS.DISTPUBSUB_COLLECTION_NAME}`)
        .doc(docId);

      return tryFsTransaction(docRef)
        .then((docNumber) => {
          console.log(
            `PUBSUB SUCCESS - docId(${docRef.id}) :: docNumber(${docNumber})`
          );
        })
        .catch((ex) => {
          console.error(
            `PUBSUB FAILURE FOR docId(${docRef.id}) - ${ex.message}`
          );
        });
    });
  });
