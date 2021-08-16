# Introduction
Some use cases require that Firestore documents contain a unique, monotomically-increasing number to distringuish each doc.
For example, you might need a "customer number" that is *human readable*.  Firestore provides unique identifiers for
documents by default (the document ID), but those values are 20+ character _case-sensitive_ alpha-numeric strings and
are frequently not considered "human readable".

Many humans are fine with **ID# 1045365766** but are not comfortable with **ID# 089QXqagDb7qFmcico20**.

In Firestore, there are ways to generate unique, monotomically-increasing identifier numbers (often in SQL-land referred
to as "identity" or "autoincrement" values).

One "traditional" method involves using a Cloud Function (CF) trigger for Firestore for documents created in a given
collection.  When a document is created, the CF trigger code gets a value from a known location in the Firestore database
(the "metadata counter"), increases the value, then updates both the metadata counter and the newly created document with
this new value.  This approach is quite straightforward to code and maintain.  However, when the number of documents
being created in a short period of time is large, this algorithm will run into transaction errors such as:
   `Error: 10 ABORTED: Aborted due to cross-transaction contention. This occurs when multiple transactions attempt to access the same data, requiring Firestore to abort at least one in order to enforce serializability.`

_Why would someone create a lot of documents in a short period of time?_, one might ask.  Well, in many business
applications it is quite typical that a _batch operation_ runs that end up generating a huge number of documents.
For example, consider a month-end run to generate customer invoices, a daily marketing campaign (emails and/or
notifications), or a workforce ticketing system.

The fantastic Firebase team has identified the problem with the "traditional" approach for large batches of documents.
They provide [documents](https://firebase.google.com/docs/firestore/solutions/counters),
[videos](https://www.youtube.com/watch?v=_FRClhniG6Q&t=317s), and [code snippets]
(https://github.com/firebase/snippets-web/blob/c5bfca32e881d7a40002285384a784749f973c35/firestore/test.solution-counters.js)
showing how to build Firestore "distributed counters" that dramatically decrease the likelihood of an error when
creating large numbers of documents in a short period of time.  There is also a [Firestore Extension for distributed
counters](https://firebase.google.com/products/extensions/firestore-counter/).

# This Project

This project's code works with two Firestore collections:  `traditional` and `distributed`.  In both collections
we are able to create new documents with a batch process (via an HTTP Cloud Function).  There is an `onCreate`
Cloud Function trigger for each collection, that when a document is created in the collection, the trigger calculates
a new `docNumber` value and adds it as a new field to the document.  `traditional`'s function does so with the
straightforward approach that leads to failures when creating multiple documents in a short period of time (e.g.
seems when the batch is called with a count of 75 or more, at least one failure occurs).  `distributed`'s function
uses a Distributed Counter algorithm providing significant scalability and avoids the failures seen with
`traditional`.

# Definitions

- FS - [Firebase Firestore](https://firebase.google.com/products/firestore) - Firebase's NoSQL document data store
- CF - [Firebase Cloud Function](https://firebase.google.com/products/functions) - Firebase's serverless execution environment

# How This Project Works

Functionality is provided in a set of Cloud Functions, described below.  Calling one of the provided HTTP CFs creates
an _batch_ of documents in the associated Firestore collection, each created asynchronously.  Essentially this
"floods" the system with requests to create multiple documents all at once.

With the _traditional_ approach, we will see errors in the CF logs due to failures trying to add the `docNumber` values.

With the distributed documents, we will see significantly less failures.  By adjusting the number of *shards* used
in the configuration, you can get dramatic throughput for concurrency and avoid errors in calcuating the
`documentNumber` value.

**fsTraditionalOnCreate** (`functions/fs/traditional/onCreate.f.js`)
> a FS trigger CF that runs when a new document is created in the FS collection named `traditional`

**fsDistributedOnCreate** (`functions/fs/distributed/onCreate.f.js`)
> a FS trigger CF that runs when a new document is created in the FS collection named `distributed`

**httpBatchCreateTraditional** (`functions/http/batchCreateTraditional.f.js`)
> an HTTP CF that, given a parameter for the _batchSize_, creates that number of documents in the `traditional` FS collection

**httpBatchCreateDistributed** (`functions/http/batchCreateDistributed.f.js`)
> an HTTP CF that, given a parameter for the _batchSize_, creates that number of documents in the `distributed` FS collection

# Running The Example

## Create Firebase Project

1. Enable Firestore

## Running in the Firebase Emulator

1. start the emulator with `firebase emulators:start --only functions,firestore`
1. cause the system to load a batch of `traditional` docs:
   `wget -Sv -Ooutput.txt --method=POST --body-data="batchSize=10" http://localhost:5001/example-fs-distributed-counter/us-central1/httpBatchCreateTraditional`
1. Re-run the above URL changing the `batchSize` parameter.
1. cause the system to load a batch of `distributed` docs:
   `wget -Sv -Ooutput.txt --method=POST --body-data="batchSize=10" http://localhost:5001/example-fs-distributed-counter/us-central1/httpBatchCreateDistributed`
1. Re-run the above URL changing the `batchSize` parameter.

## To debug the Firebase Emulator

Instructions are [here](https://medium.com/firebase-developers/debugging-firebase-functions-in-vs-code-a1caf22db0b2).
Essentially it is a matter of configuring the `launch.json`, running the emulator with the `--inspect-functions` command
line parameter, then running the debugger in VSCode.

## Running in your cloud-based Firebase project

1. deploy to your cloud project with `firebase deploy --only functions,firestore`
1. enable unauthenticated access to `httpBatchCreateTraditional` by following [these After Deployment instructions](https://cloud.google.com/functions/docs/securing/managing-access-iam#after_deployment)
1. cause the system to load a batch of `traditional` docs (you can get the URL for the HTTP function from Firebase Console >> Functions):
   `wget -Sv -Ooutput.txt --method=POST --body-data="batchSize=10" https://YOUR_FIREBASE_PROJECT.cloudfunctions.net/httpBatchCreateTraditional`
1. Re-run the above URL changing the `batchSize` parameter.
1. cause the system to load a batch of `distributed` docs:
   `wget -Sv -Ooutput.txt --method=POST --body-data="batchSize=10" http://YOUR_FIREBASE_PROJECT.cloudfunctions.net/httpBatchCreateDistributed`
1. Re-run the above URL changing the `batchSize` parameter.

# To reset the system

1. delete the `counters` collection
1. delete the `traditional` collection
1. delete the `distributed` collection

# Analysis

Running a series of tests, the goal has been to show that errors occur at a particular batch size for `traditional`,
and that the batch size can be **significantly** larger with `distributed` before seeing any errors.  Additionally,
the project enables increasing the number of _shards_ in the distributed algorithm simply by editing a single
value in `constants.js` -- the value `DISTRIBUTED_NUMBER_OF_SHARDS`.

Running the project in the Firebase Emulator does NOT show any errors.  It is likely this is because locally the emulator
uses synchronous internal queuing mechanisms, whereas in the Firebase cloud instances the queuing is asynchronous and
less _dedicated_ to a single project instance.

Running against the Firebase cloud under a few projects, it seems that a batch size of _75_ leads to consistently
having at least 1 `traditional` counter fail to update, often getting 2-3 failures per batch, and sometimes as many as 6.
Larger batches lead to even more errors.
