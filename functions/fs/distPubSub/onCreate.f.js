const functions = require('firebase-functions');
const CONSTS = require('../../constants');

const projectId = 'example-fs-distributed-counter';
const topicName = 'distPubSub_topic';

// Imports the Google Cloud client library. v1 is for the lower level
// proto access.
const { v1 } = require('@google-cloud/pubsub');

// Creates a publisher client.
const publisherClient = new v1.PublisherClient({
  // optional auth parameters
});

const publishWithRetry = async (docId) => {
  const formattedTopic = publisherClient.projectTopicPath(projectId, topicName);

  const data = JSON.stringify({ docId: docId });

  // Publishes the message as JSON object
  const dataBuffer = Buffer.from(data);
  const messagesElement = {
    data: dataBuffer,
  };
  const messages = [messagesElement];

  // Build the request
  const request = {
    topic: formattedTopic,
    messages: messages,
  };

  // Retry settings control how the publisher handles retryable failures.
  // Default values are shown.
  // The `retryCodes` array determines which GRPC errors trigger a retry.
  // The `backoffSettings` object lets you specify the behaviour of retries.
  const retrySettings = {
    retryCodes: [
      10, // 'ABORTED'
      1, // 'CANCELLED',
      4, // 'DEADLINE_EXCEEDED'
      13, // 'INTERNAL'
      8, // 'RESOURCE_EXHAUSTED'
      14, // 'UNAVAILABLE'
      2, // 'UNKNOWN'
    ],
    backoffSettings: {
      // The initial delay time, in milliseconds, between the completion
      // of the first failed request and the first retry request.
      initialRetryDelayMillis: 100,
      // The multiplier to increase the delay time between the completion
      // of failed requests, and the initiation of the subsequent retry.
      retryDelayMultiplier: 1.3,
      // The maximum delay time, in milliseconds, between requests.
      // When this value is reached, retryDelayMultiplier is no longer used.
      maxRetryDelayMillis: 60000,
      // The initial timeout parameter to the request.
      initialRpcTimeoutMillis: 5000,
      // The multiplier to increase the timeout between failed requests.
      rpcTimeoutMultiplier: 1.0,
      // The maximum timeout, in milliseconds, for a request. When reached,
      // rpcTimeoutMultiplier will no longer be used to increase the timeout.
      maxRpcTimeoutMillis: 600000,
      // The total time, in milliseconds, from when the initial request is sent,
      // after which an error will be returned, regardless of retry attempts.
      totalTimeoutMillis: 600000,
    },
  };

  const [response] = await publisherClient.publish(request, {
    retry: retrySettings,
  });
  console.log(
    `publishWithRetry(): published(${response.messageIds}) for docId(${docId})`
  );
};

// Cloud Function to increment the document field after creation.
export default functions
  .runWith({ memory: '1GB', timeoutSeconds: 300 })
  .firestore.document(`${CONSTS.DISTPUBSUB_COLLECTION_NAME}/{docId}`)
  .onCreate((snap, context) => {
    console.log(`distPubSub: onCreate(${snap.ref.id})`);
    return publishWithRetry(snap.ref.id).catch((e) => {
      console.error('distPubSub: publishWithRetry() FAILED!!', e);
    });
  });
