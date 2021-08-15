const functions = require('firebase-functions');
const admin = require('firebase-admin');

const CONSTS = require('../../constants');

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
      .doc(CONSTS.DISTRIBUTED_COLLECTION_NAME)
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

  // Update count
  transaction.update(shardRef, {
    count: admin.firestore.FieldValue.increment(1),
  });
};

const getCount = (transaction, ref) => {
  // Sum the count of each shard in the subcollection
  const shardsRef = ref.collection(CONSTS.DISTRIBUTED_SHARDS_COLLECTION_NAME);
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
  .document(`${CONSTS.DISTRIBUTED_COLLECTION_NAME}/{docId}`)
  .onCreate((snap, context) => {
    let number;
    let metaData;
    const origDocRef = snap.ref;

    try {
      // Run inside a transaction
      const trans = db.runTransaction(async (transaction) => {
        // Get the metadata document and increment the count.

        const newCounterRef = db
          .collection(CONSTS.COUNTERS_PATH)
          .doc(CONSTS.DISTRIBUTED_COUNTER_NAME);
        // const metaRef = db.collection(path);
        metaData = await transaction.get(newCounterRef);

        if (metaData && metaData.exists) {
          const count = await getCount(transaction, newCounterRef);
          number = count + 1;
          incrementCounter(transaction, newCounterRef, 1);
        } else {
          logger.warn(
            'actCounter metadata not found: ' +
              `(${CONSTS.COUNTERS_PATH}) -- CREATING IT NOW`
          );
          number = 1;
          createCounter(newCounterRef, 1);
        }

        transaction.update(origDocRef, {
          actNumber: number,
        });
      });

      return trans;
    } catch (ex) {
      origDocRef.get().then((doc) => {
        if (doc.exists) {
          logger.error(
            `ON CREATE DISTRIBUTED: failed to update {data: (${doc.data})}\n\n`,
            ex
          );
        } else {
          logger.error('ON CREATE DISTRIBUTED: doc does not exist!\n\n', ex);
        }
      });
      return null;
    }
  });
