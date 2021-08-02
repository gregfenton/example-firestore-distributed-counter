const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();
const logger = functions.logger;

const COLLECTION_NAME = 'distributed';
const COUNTERS_PATH = 'counters';
const COUNTER_NAME = 'distCount';
const SHARDS_COLLECTION_NAME = 'shards';

const createCounter = (ref, numShards) => {
  const batch = db.batch();

  // Initialize the counter document
  batch.set(ref, { num_shards: numShards });

  // Initialize each shard with count=0
  for (let i = 0; i < numShards; i++) {
    const shardRef = db
      .collection(COUNTERS_PATH)
      .doc(COLLECTION_NAME)
      .collection(SHARDS_COLLECTION_NAME)
      .doc(i.toString());
    batch.set(shardRef, { count: 0 });
  }

  // Commit the write batch
  return batch.commit();
};

const incrementCounter = (transaction, ref, numShards) => {
  // Select a shard of the counter at random
  const shardId = Math.floor(Math.random() * numShards).toString();
  const shardRef = ref.collection(SHARDS_COLLECTION_NAME).doc(shardId); // ref

  // Update count
  transaction.update(shardRef, {
    count: admin.firestore.FieldValue.increment(1),
  });
};

const getCount = (transaction, ref) => {
  // Sum the count of each shard in the subcollection
  const shardsRef = ref.collection(SHARDS_COLLECTION_NAME);
  return transaction.get(shardsRef).then((snapshot) => {
    let totalCount = 0;
    snapshot.forEach((doc) => {
      totalCount += doc.data().count;
    });

    return totalCount;
  });
};

// Cloud Function to increment the document field after creation.
export default functions.firestore
  .document(`${COLLECTION_NAME}/{docId}`)
  .onCreate((snap, context) => {
    // Run inside a transaction
    return db.runTransaction(async (transaction) => {
      // Get the metadata document and increment the count.

      const newCounterRef = db.collection(COUNTERS_PATH).doc(COUNTER_NAME);
      // const metaRef = db.collection(path);
      const metaData = await transaction.get(newCounterRef);
      let number;

      if (metaData && metaData.exists) {
        const count = await getCount(transaction, newCounterRef);
        number = count + 1;
        incrementCounter(transaction, newCounterRef, 1);
      } else {
        logger.warn(
          'actCounter metadata not found: ' +
            `(${COUNTERS_PATH}) -- CREATING IT NOW`
        );
        number = 1;
        createCounter(newCounterRef, 1);
      }

      // Update the act document
      const actRef = snap.ref;

      transaction.update(actRef, {
        actNumber: number,
      });
    });
  });
