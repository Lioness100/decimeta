import { load } from 'cheerio';

export interface MDSNode {
	children: MDSNode[];
	name: string;
	number: string;
}

const nodeCache = new Map<string, MDSNode>();

const baseURL = new URL('https://www.librarything.com/mds/');
async function fetchMDSPage(pagePath: string) {
	const url = new URL(pagePath, baseURL);
	const response = await fetch(url);
	const html = await response.text();
	const $ = load(html);

	const entries: Omit<MDSNode, 'children'>[] = [];

	$('tr.ddcr:not(.somethingchosen) td:has(> div.word)').each((_, element) => {
		const $td = $(element);
		const number = $td.find('.ddcnum').text().trim();
		const name = $td.find('.word').text().trim();

		if (
			name &&
			name !== '>' &&
			!name.startsWith('-') &&
			!name.startsWith('–') &&
			!name.includes('[No Longer') &&
			!name.toLowerCase().includes('assigned') &&
			name !== 'Invalid number' &&
			!name.startsWith('[form')
		) {
			entries.push({ name, number });
		}
	});

	return entries;
}

function findOrCreateNode(tree: MDSNode[], number: string, name: string): MDSNode | null {
	const normalizedNumber = number.padEnd(3, '0');

	if (nodeCache.has(normalizedNumber)) {
		return nodeCache.get(normalizedNumber)!;
	}

	const node = { name, number: normalizedNumber, children: [] };

	if (number.length === 1) {
		tree.push(node);
		nodeCache.set(normalizedNumber, node);
		console.log(`✓ Added ${normalizedNumber}: ${name}`);
		return node;
	}

	const [wholePart, decimalPart] = number.split('.');
	const parentNode = nodeCache.get(!decimalPart || decimalPart[1] ? number.slice(0, -1) : wholePart);

	if (!parentNode) {
		return null;
	}

	parentNode.children.push(node);
	nodeCache.set(normalizedNumber, node);
	console.log(`✓ Added ${normalizedNumber}: ${name}`);

	return node;
}

async function processNode(tree: MDSNode[], nodePath: string, processed: Set<string>): Promise<void> {
	if (processed.has(nodePath)) {
		return;
	}

	processed.add(nodePath);

	try {
		const entries = await fetchMDSPage(nodePath);
		const childTasks: Promise<void>[] = [];

		for (const entry of entries) {
			findOrCreateNode(tree, entry.number, entry.name);
			childTasks.push(processNode(tree, entry.number, processed));
		}

		await Promise.all(childTasks);
	} catch (error) {
		console.error(`Error processing ${nodePath}:`, error);
	}
}

let globalTree: MDSNode[] = [];

async function buildTree(): Promise<MDSNode[]> {
	const tree: MDSNode[] = [];
	const processed = new Set<string>();

	globalTree = tree;

	console.log('Fetching root level…');
	const rootEntries = await fetchMDSPage('');

	for (const entry of rootEntries) {
		findOrCreateNode(tree, entry.number, entry.name);
	}

	console.log(`\nProcessing ${tree.length} root nodes\n`);

	const rootTasks = tree.map((rootNode) => {
		const rootDigit = rootNode.number[0];
		return processNode(tree, rootDigit, processed);
	});

	await Promise.all(rootTasks);
	return tree;
}

function sortTree(nodes: MDSNode[]) {
	nodes.sort((a, b) => a.number.localeCompare(b.number));
	for (const node of nodes) {
		sortTree(node.children);
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
		console.log('\n\n⚠️  Interrupted! Saving progress to mds-temp.json…');
		void saveTree(globalTree, 'mds-temp.json').then(() => {
			console.log('✓ Progress saved successfully!');
			process.exit(0);
		});
	});

	const tree = await buildTree();
	await saveTree(tree, 'mds.json');
	console.log(`Total root nodes: ${tree.length}`);
}
