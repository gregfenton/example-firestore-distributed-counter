const functions = require('firebase-functions');
const CONSTS = require('../../constants');

const projectId = 'example-fs-distributed-counter';
const topicName = 'distPubSub_topic';

// Cloud Function to increment the document field after creation.
export default functions
  .runWith({ memory: '1GB', timeoutSeconds: 300 })
  .firestore.document(`${CONSTS.DISTPUBSUB_COLLECTION_NAME}/{docId}`)
  .onCreate((snap, context) => {
    console.log(
      'distPubSubOnCreate(): PUB envs are: ' +
        Object.keys(process.env).filter((x) => x.startsWith('PUB'))
    );

    console.log(`distPubSubOnCreate(): onCreate(${snap.ref.id})`);
    console.log(
      'distPubSubOnCreate(): PUBSUB_EMULATOR_HOST is (' +
        `${process.env.PUBSUB_EMULATOR_HOST})`
    );
    console.log(
      'distPubSubOnCreate(): PUBSUB_PROJECT_ID is (' +
        `${process.env.PUBSUB_PROJECT_ID})`
    );
    console.log(
      `distPubSubOnCreate(): GCLOUD_PROJECT is (${process.env.GCLOUD_PROJECT})`
    );

    try {
      // Imports the Google Cloud client library. v1 is for the lower level
      // proto access.
      const { v1 } = require('@google-cloud/pubsub');

      // Creates a publisher client.
      const publisherClient = new v1.PublisherClient({
        projectId: process.env.GCLOUD_PROJECT,
        port: 8085,
        api: 'localhost',
        // optional auth parameters
      });

      const formattedTopic = publisherClient.projectTopicPath(
        projectId,
        topicName
      );

      const data = JSON.stringify({ docId: snap.id });

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

      console.log('CALLING .publish()');
      return publisherClient
        .publish(request)
        .then(([responses]) => {
          console.log(
            `distPubSubOnCreate(): responses is ${JSON.stringify(
              responses,
              null,
              2
            )}`
          );
          console.log(
            `distPubSubOnCreate(): published(${responses.messageIds}) ` +
              `for docId(${snap.id})`
          );
        })
        .catch((ex) => {
          console.error(`distPubSubOnCreate(): ERROR: ${ex.message}`);
          throw ex; // be sure to fail the function
        });
    } catch (ex) {
      console.log(`EXCEPTION: ${ex.message}`);
      throw ex;
    }
  });
