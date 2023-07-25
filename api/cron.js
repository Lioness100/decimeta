import { PineconeClient } from "@pinecone-database/pinecone";

const client = new PineconeClient();
await client.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
});

export default async (_, res) => {
	await client.describeIndex({ indexName: process.env.PINECONE_INDEX });
	return res.status(200).json(docs);
};
