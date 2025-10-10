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

function findNodeByPath(nodePath: string): MDSNode | null {
	if (!nodePath) {
		return null;
	}

	if (nodeCache.has(nodePath)) {
		return nodeCache.get(nodePath)!;
	}

	if (nodePath.includes('.')) {
		const [wholePart, decimalPart] = nodePath.split('.');

		for (let i = decimalPart.length; i > 0; i--) {
			const testPath = `${wholePart}.${decimalPart.slice(0, i)}`;
			if (nodeCache.has(testPath)) {
				return nodeCache.get(testPath)!;
			}
		}

		return findNodeByPath(wholePart);
	}

	for (let i = nodePath.length; i > 0; i--) {
		const testPath = nodePath.slice(0, i).padEnd(3, '0');
		if (nodeCache.has(testPath)) {
			return nodeCache.get(testPath)!;
		}
	}

	return null;
}

function findOrCreateNode(tree: MDSNode[], number: string, name: string): MDSNode | null {
	let parentNode: MDSNode | null = null;
	let normalizedNumber: string;

	if (number.includes('.')) {
		normalizedNumber = number;

		if (nodeCache.has(normalizedNumber)) {
			return nodeCache.get(normalizedNumber)!;
		}

		const [wholePart, decimalPart] = number.split('.');

		for (let len = decimalPart.length - 1; len > 0 && !parentNode; len--) {
			const parentNumber = `${wholePart}.${decimalPart.slice(0, len)}`;
			parentNode = findNodeByPath(parentNumber);
		}

		parentNode ??= findNodeByPath(wholePart);
	} else if (number.length === 1) {
		normalizedNumber = number.padEnd(3, '0');

		if (nodeCache.has(normalizedNumber)) {
			return nodeCache.get(normalizedNumber)!;
		}

		const node = { children: [], name, number: normalizedNumber };
		tree.push(node);
		nodeCache.set(normalizedNumber, node);
		console.log(`✓ Added ${normalizedNumber}: ${name}`);
		return node;
	} else {
		normalizedNumber = number.padEnd(3, '0');

		if (nodeCache.has(normalizedNumber)) {
			return nodeCache.get(normalizedNumber)!;
		}

		const parentNumber = number.slice(0, -1);
		parentNode = findNodeByPath(parentNumber);
	}

	if (!parentNode) {
		return null;
	}

	const node = { children: [], name, number: normalizedNumber };
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

function countNodes(nodes: MDSNode[]): number {
	let count = nodes.length;
	for (const node of nodes) {
		count += countNodes(node.children);
	}

	return count;
}

async function saveTree(tree: MDSNode[], filename: string) {
	await Bun.write(filename, JSON.stringify(tree, null, 2));
	const totalNodes = countNodes(tree);
	console.log(`\n💾 Saved ${totalNodes} nodes to ${filename}`);
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
