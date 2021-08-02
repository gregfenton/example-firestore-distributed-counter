# Introduction
Some use cases require that Firestore documents contain a unique, monotomically-increasing number to distringuish each doc.  For example, you might need a "customer number" that is *human readable*.

Firestore provides unique identifiers for documents by default (the document ID), but those values are 20+ character case-sensitive alpha-numeric strings and are frequently not considered "human readable".

This project has two Firestore collections:  `traditional` and `distributed`.  In both collections we are able to create new documents.  There is an `onCreate` Cloud Function trigger for each collection.  When a document is created in the collection, the Cloud Function calculates a new `documentNumber` value and adds it to the document.  `traditional`'s function does so with a straightforward approach that leads to failures when creating multiple documents in a short period of time (e.g. via a batch import or via a "cron job").  `distributed`'s function uses a Distributed Counter algorithm providing significant scalability and avoids the failures seen with `traditional`.

# Definitions

- FS - Firebase Firestore
- CF - Firebase Cloud Function

# How This Project Works

Functionality is provided in a set of Cloud Functions, described below.  Calling one of the HTTP functions creates a number of documents in the associated Firestore collection, each created asynchronously.  Essentially this "floods" the system with requests to create multiple documents all at once.

With the traditional documents, we will see errors in the CF logs due to failures trying to add the `documentNumber` values.

With the distributed documents, we will see significantly less failures.  By adjusting the number of *shards* used in the configuration, you can get dramatic throughput for concurrency and avoid errors in calcuating the `documentNumber` value.

**fsTraditionalOnCreate**
> a FS trigger CF that runs when a new document is created in the FS collection named `traditional`

**fsDistributedOnCreate**
> a FS trigger CF that runs when a new document is created in the FS collection named `distributed`

**httpBatchCreateTraditional**
> an HTTP CF that, given a number parameter, creates that number of documents in the `traditional` FS collection

**httpBatchCreateDistributed**
> an HTTP CF that, given a number parameter, creates that number of documents in the `distributed` FS collection

# Running The Example

## Create Firebase Project

1. Enable Firestore

## Running in the Firebase Emulator

1. start the emulator with `firestore emulators:start --only functions,firestore`
1. cause the system to load a batch of `traditional` docs:
   `wget -Sv -Ooutput.txt --method=POST --body-data="batchSize=10" http://localhost:5001/example-fs-distributed-counter/us-central1/httpBatchCreateTraditional`

## Running in your cloud-based Firebase project

1. deploy to your cloud project with `firestore deploy --only functions,firestore`
1. enable unauthenticated access to `httpBatchCreateTraditional` by following [these After Deployment instructions](https://cloud.google.com/functions/docs/securing/managing-access-iam#after_deployment)
1. cause the system to load a batch of `traditional` docs (you can get the URL for the HTTP function from Firebase Console >> Functions):
   `wget -Sv -Ooutput.txt --method=POST --body-data="batchSize=10" https://YOUR_FIREBASE_PROJECT/example-fs-distributed-counter/us-central1/httpBatchCreateTraditional`

