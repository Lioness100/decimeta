import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = await MemoryVectorStore.load(
	'data',
	new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
);

export default async (req, res) => {
	const docs = await vectorStore.similaritySearchWithScore(req.query.search, 8);
	res.setHeader('Cache-Control', 'public, max-age=3600');
	return res.status(200).json(docs);
};
