import { OpenAI } from 'openai';
import type { MDSNode } from './scraper';

const tree: MDSNode[] = await Bun.file('data/mds.json').json();
const client = new OpenAI();

export async function queryOpenAI(query: string, options: string[], breadcrumb?: string, parent?: string) {
	const input = `Which does the query belong to? Reply JUST the number${parent ? ` or "parent" to stop at ${parent}.` : ''}
Query: "${query}"${breadcrumb ? `\nBreadcrumb: ${breadcrumb}` : ''}
Options: ${options.join(', ')}
`;

	const response = await client.responses.create({ model: 'gpt-4.1', input, temperature: 0 });
	return response.output_text.split(' ')[0];
}

export interface ClassificationUpdate {
	breadcrumb: string;
	finished: boolean;
	name: string;
	number: string;
}

export async function* classify(
	query: string,
	nodes = tree,
	parent?: MDSNode,
	breadcrumb = ''
): AsyncGenerator<ClassificationUpdate> {
	const options = nodes.map((node) => `${node.number} ${node.name}`);
	const number = await queryOpenAI(query, options, breadcrumb, parent && `${parent.number} ${parent.name}`);
	const isParent = number.toLowerCase() === 'parent';
	const matchedNode = isParent ? parent : nodes.find((node) => node.number === number);

	if (!matchedNode) {
		throw new Error(`No matching node found for response: ${number}`);
	}

	const isFinished = isParent || matchedNode.children.length === 0;
	yield { breadcrumb, name: matchedNode.name, number: matchedNode.number, finished: isFinished };

	if (isFinished) {
		return;
	}

	if (breadcrumb) {
		breadcrumb += ' > ';
	}

	breadcrumb += matchedNode.name;
	yield* classify(query, matchedNode.children, matchedNode, breadcrumb);
}
