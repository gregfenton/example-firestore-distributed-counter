const functions = require('firebase-functions');
const admin = require('firebase-admin');

const CONSTS = require('../../constants');

const db = admin.firestore();
const logger = functions.logger;

// Cloud Function to increment the document field after creation.
export default functions.firestore
  .document(`${CONSTS.TRADITIONAL_COLLECTION_NAME}/{docId}`)
  .onCreate((snap, context) => {
    // Run inside a transaction
    let number;
    const origDocRef = snap.ref;

    try {
      const trans = db.runTransaction(async (transaction) => {
        // Get the counter document and increment the count
        const counterRef = db
          .collection(CONSTS.COUNTERS_PATH)
          .doc(CONSTS.TRADITIONAL_COUNTER_NAME);
        let counterDoc = await transaction.get(counterRef);

        counterDoc = counterDoc.data();
        if (
          counterDoc &&
          Object.prototype.hasOwnProperty.call(
            counterDoc,
            CONSTS.TRADITIONAL_COUNTER_COUNT_PROPERTY
          )
        ) {
          number = counterDoc.count + 1;
          transaction.update(counterRef, {
            [CONSTS.TRADITIONAL_COUNTER_COUNT_PROPERTY]: number,
          });
          console.log(`TRADITIONAL: new counter number: ${number}`);
        } else {
          logger.warn(
            'Count metadata not found: ' +
              `(${CONSTS.COUNTERS_PATH}.${CONSTS.TRADITIONAL_COUNTER_NAME}.` +
              `${CONSTS.TRADITIONAL_COUNTER_COUNT_PROPERTY})` +
              ' -- CREATING IT NOW'
          );
          number = CONSTS.TRADITIONAL_COUNTER_INITIAL_VALUE;
          transaction.set(counterRef, {
            [CONSTS.TRADITIONAL_COUNTER_COUNT_PROPERTY]: number,
          });
        }

        // Update the document
        transaction.update(origDocRef, {
          [CONSTS.DOCUMENT_NUM_PROPERTY]: number,
        });
        const doc = await origDocRef.get();
        if (doc.exists) {
          const data = doc.data();
          console.info(
            `doc: {data:(${
              data[CONSTS.DOCUMENT_DATA_PROPERTY]
            })} -- set number to (${number})`
          );
        } else {
          console.info(`FAILED to find doc -- number was to be (${number})`);
        }
      });

      return trans;
    } catch (ex) {
      origDocRef.get().then((doc) => {
        if (doc.exists) {
          logger.error(
            `ON CREATE TRADITIONAL: failed to update {data: (${doc.data})}\n\n`,
            ex
          );
        } else {
          logger.error('ON CREATE TRADITIONAL: doc does not exist!\n\n', ex);
        }
      });
      return null;
    }
  });
