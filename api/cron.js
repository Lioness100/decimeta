import { Pinecone } from "@pinecone-database/pinecone";

const pc = new Pinecone();

export default async (_, res) => {
	await pc.describeIndex(process.env.PINECONE_INDEX);
	return res.status(200).json(docs);
};
