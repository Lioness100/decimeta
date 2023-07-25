import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";

const client = new PineconeClient();
await client.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
});

const pineconeIndex = client.Index(process.env.PINECONE_INDEX);
const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
const vectorStore = new PineconeStore(embeddings, { pineconeIndex });

export default async (req, res) => {
	const docs = await vectorStore.similaritySearchWithScore(req.query.search, 5);
	res.setHeader('Cache-Control', 'public, max-age=3600');
	return res.status(200).json(docs);
};
