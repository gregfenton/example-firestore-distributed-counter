const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();
const logger = functions.logger;

const COLLECTION_NAME = 'traditional';
const COUNTERS_PATH = 'counters';
const COUNTER_NAME = 'tradCount';
const COUNTER_COUNT_PROPERTY = 'count';
const COUNTER_INITIAL_VALUE = 1;
const DOCUMENT_NUM_PROPERTY = 'docNumber';

// Cloud Function to increment the document field after creation.
export default functions.firestore
  .document(`${COLLECTION_NAME}/{docId}`)
  .onCreate((snap, context) => {
    // Run inside a transaction
    return db.runTransaction(async (transaction) => {
      // Get the counter document and increment the count
      const counterRef = db.collection(COUNTERS_PATH).doc(COUNTER_NAME);
      let counterDoc = await transaction.get(counterRef);

      let number;
      counterDoc = counterDoc.data();
      if (
        counterDoc &&
        Object.prototype.hasOwnProperty.call(counterDoc, COUNTER_COUNT_PROPERTY)
      ) {
        number = counterDoc.count + 1;
        transaction.update(counterRef, { [COUNTER_COUNT_PROPERTY]: number });
        console.log(`TRADITIONAL: new counter number: ${number}`);
      } else {
        logger.warn(
          'Count metadata not found: ' +
            `(${COUNTERS_PATH}.${COUNTER_NAME}.${COUNTER_COUNT_PROPERTY})` +
            ' -- CREATING IT NOW'
        );
        number = COUNTER_INITIAL_VALUE;
        transaction.set(counterRef, { [COUNTER_COUNT_PROPERTY]: number });
      }

      // Update the document
      const origDocRef = snap.ref;

      transaction.update(origDocRef, {
        [DOCUMENT_NUM_PROPERTY]: number,
      });
    });
  });
