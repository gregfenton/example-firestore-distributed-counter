const functions = require('firebase-functions');

const projectId = 'example-fs-distributed-counter';
const topicName = 'distPubSub_topic';

export default functions.https.onRequest(async (req, res) => {
  console.log('testPublish started');

  console.log(`PUBSUB_EMULATOR_HOST is (${process.env.PUBSUB_EMULATOR_HOST})`);
  console.log(`PUBSUB_PROJECT_ID is (${process.env.PUBSUB_PROJECT_ID})`);
  console.log(`GCLOUD_PROJECT is (${process.env.GCLOUD_PROJECT})`);

  const { v1 } = require('@google-cloud/pubsub');
  const publisherClient = new v1.PublisherClient({
    projectId: process.env.GCLOUD_PROJECT,
  });
  const formattedTopic = publisherClient.projectTopicPath(projectId, topicName);

  const data = JSON.stringify({ hello: 'world!' });

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
      console.log(`responses is ${JSON.stringify(responses, null, 2)}`);
      console.log(`published(${responses.messageIds}) `);
      res.sendStatus(200);
    })
    .catch((ex) => {
      console.error(`ERROR: ${ex.message}`);
      res.sendStatus(555);
      throw ex; // be sure to fail the function
    });
});
