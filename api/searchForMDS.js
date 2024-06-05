import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";

const client = new Pinecone();
const pineconeIndex = client.Index(process.env.PINECONE_INDEX);
const vectorStore = await PineconeStore.fromExistingIndex(
	new OpenAIEmbeddings(),
	{ pineconeIndex }
);

export default async (req, res) => {
	const docs = await vectorStore.similaritySearchWithScore(req.query.search, 5);
	res.setHeader('Cache-Control', 'public, max-age=3600');
	return res.status(200).json(docs);
};
