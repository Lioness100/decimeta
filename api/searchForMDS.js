import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = await HNSWLib.load(
	'data',
	new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
);

export default async (req, res) => {
	const docs = await vectorStore.similaritySearchWithScore(req.query.search, 8);
	res.setHeader('Cache-Control', 'public, max-age=3600');
	return res.status(200).json(docs);
};
