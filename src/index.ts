/* eslint-disable @typescript-eslint/naming-convention */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import NodeCache from 'node-cache';
import { searchDocuments } from './embeddings';
import { classify } from './classify';

const app = express();

app.use(cors());
app.use(helmet());
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }));
app.use(express.static('public'));
app.disable('x-powered-by');

const gptCache = new NodeCache({ stdTTL: 300 });
const embeddingsCache = new NodeCache({ stdTTL: 300 });

app.get('/api/classify/embeddings', async (req, res) => {
	const query = req.query.query?.toString().trim().toLowerCase();

	if (!query) {
		return res.status(400).json({ error: 'Query parameter is required' });
	}

	if (query.length > 500) {
		return res.status(400).json({ error: 'Query too long. Maximum 500 characters.' });
	}

	const result = embeddingsCache.get(query) ?? (await searchDocuments(query));
	if (!embeddingsCache.has(query)) {
		embeddingsCache.set(query, result);
	}

	res.set({
		'Cache-Control': 'public, max-age=300, s-maxage=600',
		'X-Cache': embeddingsCache.has(query) ? 'HIT' : 'MISS'
	});
	res.json(result);
});

app.get('/api/classify/gpt', async (req, res) => {
	const query = req.query.query?.toString().trim().toLowerCase();

	if (!query) {
		return res.status(400).json({ error: 'Query parameter is required' });
	}

	if (query.length > 500) {
		return res.status(400).json({ error: 'Query too long. Maximum 500 characters.' });
	}

	const cachedResult = gptCache.get(query);
	if (cachedResult) {
		res.set({
			'Cache-Control': 'public, max-age=300, s-maxage=600',
			'X-Cache': 'HIT'
		});
		return res.json(cachedResult);
	}

	res.set({
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		'X-Accel-Buffering': 'no',
		'X-Cache': 'MISS'
	});

	for await (const update of classify(query)) {
		res.write(`${JSON.stringify(update)}\n`);
		if (update.finished) {
			gptCache.set(query, update);
			res.end();
		}
	}
});

app.use((_req, res) => {
	res.redirect('/');
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
	console.error('Unhandled error:', err);
	res.status(500).json({
		error: 'Internal server error',
		...(process.env.NODE_ENV === 'development' && { details: err.message, stack: err.stack })
	});
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
