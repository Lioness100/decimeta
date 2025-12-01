import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from 'langchain/document';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import type { MDSNode } from './scraper';

process.env.PINECONE_INDEX ||= 'decimeta';

const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small', verbose: import.meta.main });
const pinecone = new Pinecone();

const indexList = await pinecone.listIndexes();
const indexExists = indexList.indexes?.some((index) => index.name === process.env.PINECONE_INDEX);

if (!indexExists) {
	await pinecone.createIndex({
		name: process.env.PINECONE_INDEX,
		dimension: 1536,
		metric: 'cosine',
		spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
	});

	console.log(`✓ Created Pinecone index: ${process.env.PINECONE_INDEX}`);
}

const index = pinecone.index(process.env.PINECONE_INDEX);
const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { pineconeIndex: index });

export async function upsertDocuments(documents: Document[]) {
	await vectorStore.addDocuments(documents);
}

export async function searchDocuments(query: string) {
	const results = await vectorStore.similaritySearchWithScore(query, 5);
	return results.map(([doc, score]) => ({ ...doc.metadata, score }));
}

export function nodeToDocument(node: MDSNode, breadcrumb = '', level = 0) {
	const fullBreadcrumb = breadcrumb ? `${breadcrumb} > ${node.name}` : node.name;
	const text = breadcrumb ? `${node.number} ${node.name} — in ${breadcrumb}` : `${node.number} ${node.name}`;

	return new Document({
		pageContent: text,
		metadata: { number: node.number, name: node.name, breadcrumb: fullBreadcrumb, level }
	});
}

export function* treeToDocuments(nodes: MDSNode[], parentBreadcrumb = '', level = 0): Generator<Document> {
	for (const node of nodes) {
		yield nodeToDocument(node, parentBreadcrumb, level);

		if (node.children.length > 0) {
			const currentBreadcrumb = parentBreadcrumb ? `${parentBreadcrumb} > ${node.name}` : node.name;
			yield* treeToDocuments(node.children, currentBreadcrumb, level + 1);
		}
	}
}

if (import.meta.main) {
	const tree = await Bun.file('mds.json').json();
	await upsertDocuments([...treeToDocuments(tree)]);
	console.log('✓ Documents upserted successfully');
	const search = await searchDocuments('Space Exploration');
	console.log('Search results for "Space Exploration":', search);
}
