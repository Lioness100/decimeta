import { load } from 'cheerio';

export interface MDSNode {
	children?: MDSNode[];
	name: string;
	number: string;
}

const nodeCache = new Map<string, MDSNode>();
const tree: MDSNode[] = [];
const processed = new Set<string>();
const baseURL = new URL('https://www.librarything.com/mds/');

async function fetchMDSPage(pagePath: string) {
	const url = new URL(pagePath, baseURL);
	const response = await fetch(url);
	const html = await response.text();
	const $ = load(html);

	const entries = $('tr.ddcr:not(.somethingchosen) td:has(> div.word)').map((_, element) => {
		const $td = $(element);
		const number = $td.find('.ddcnum').text();
		const name = $td.find('.word').text();
		return { name, number };
	});

	return entries.toArray();
}

function createNode(tree: MDSNode[], number: string, name: string) {
	const normalizedNumber = number.padEnd(3, '0');
	const node = { name, number: normalizedNumber };

	if (number.length === 1) {
		tree.push(node);
	} else {
		const parentKey = number.slice(0, -1).replace(/\.$/, '');
		const parentNode = nodeCache.get(parentKey);

		if (!parentNode) {
			return null;
		}

		(parentNode.children ??= []).push(node);
	}

	nodeCache.set(number, node);
	console.log(`✓ Added ${number}: ${name}`);
}

async function processNode(tree: MDSNode[], nodePath: string) {
	if (processed.has(nodePath)) {
		return;
	}

	processed.add(nodePath);

	try {
		const entries = await fetchMDSPage(nodePath);
		await Promise.all(
			entries.map((entry) => {
				createNode(tree, entry.number, entry.name);
				return processNode(tree, entry.number);
			})
		);
	} catch (error) {
		console.error(`Error processing ${nodePath}:`, error);
	}
}

async function buildTree() {
	console.log('Fetching root level…');
	const rootEntries = await fetchMDSPage('');

	for (const entry of rootEntries) {
		createNode(tree, entry.number, entry.name);
	}

	console.log(`\nProcessing ${tree.length} root nodes\n`);
	await Promise.all(tree.map((node) => processNode(tree, node.number[0])));
}

function sortTree(nodes: MDSNode[]) {
	nodes.sort((a, b) => a.number.localeCompare(b.number));
	for (const node of nodes) {
		if (node.children) {
			sortTree(node.children);
		}
	}
}

async function saveTree(tree: MDSNode[], filename: string) {
	sortTree(tree);
	await Bun.write(filename, JSON.stringify(tree, null, 1));
	console.log(`\n💾 Saved ${nodeCache.size} nodes to ${filename}`);
}

if (import.meta.main) {
	console.log('Starting MDS scraping…');

	process.on('SIGINT', () => {
		console.log('\n\n⚠️  Interrupted! Saving progress to data/mds-temp.json…');
		void saveTree(tree, 'data/mds-temp.json').then(() => process.exit(0));
	});

	await buildTree();
	await saveTree(tree, 'data/mds.json');
}
