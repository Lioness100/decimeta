const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
	const currentTheme = html.getAttribute('data-theme');
	const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
	html.setAttribute('data-theme', newTheme);
	localStorage.setItem('theme', newTheme);
});

const searchForm = document.getElementById('searchForm');
const queryInput = document.getElementById('queryInput');
const searchButton = document.getElementById('searchButton');
const resultsContainer = document.getElementById('resultsContainer');

const embeddingsLoader = document.getElementById('embeddingsLoader');
const embeddingsResults = document.getElementById('embeddingsResults');
const embeddingsError = document.getElementById('embeddingsError');

const gptLoader = document.getElementById('gptLoader');
const gptProgress = document.getElementById('gptProgress');
const gptResults = document.getElementById('gptResults');
const gptError = document.getElementById('gptError');

let isSearching = false;

searchForm.addEventListener('submit', async (e) => {
	e.preventDefault();

	if (isSearching) return;

	const query = queryInput.value.trim();
	if (!query) return;

	await performSearch(query);
});

async function performSearch(query) {
	const container = document.querySelector('.container');
	const searchSection = document.querySelector('.search-section');
	container.classList.remove('hero-mode');
	searchSection.classList.remove('hero-mode');

	const decorativeBooks = document.querySelector('.decorative-books');
	const ddcNumbers = document.querySelector('.ddc-numbers');
	decorativeBooks?.classList.add('faded');
	ddcNumbers?.classList.add('faded');

	isSearching = true;
	searchButton.disabled = true;
	resultsContainer.classList.add('visible');

	resetResults();

	await Promise.all([searchEmbeddings(query), searchGPT(query)]).finally(() => {
		isSearching = false;
		searchButton.disabled = false;
	});
}

function resetResults() {
	const hideElements = [embeddingsLoader, gptLoader];
	const clearVisibleElements = [embeddingsResults, embeddingsError, gptProgress, gptResults, gptError];

	hideElements.forEach((el) => el.classList.remove('hidden'));
	clearVisibleElements.forEach((element) => {
		element.classList.remove('visible');
		element.innerHTML = '';
	});
}

function handleAPIError(error, loaderElement, errorElement, timerId) {
	clearInterval(timerId);
	console.error('API error:', error);
	loaderElement.classList.add('hidden');
	errorElement.innerHTML = `<strong>Error</strong> ${error.message}`;
	errorElement.classList.add('visible');
}

async function searchEmbeddings(query) {
	const startTime = performance.now();
	const timerId = startRealtimeTimer('embeddingsTime', startTime);

	try {
		const response = await fetch(`/api/classify/embeddings?query=${encodeURIComponent(query)}`);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const results = await response.json();
		clearInterval(timerId);
		const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
		updateTimeBadge('embeddingsTime', elapsedTime);

		embeddingsLoader.classList.add('hidden');

		if (results && results.length > 0) {
			displayEmbeddingsResults(results);
		} else {
			embeddingsResults.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No results found</p>';
			embeddingsResults.classList.add('visible');
		}
	} catch (error) {
		handleAPIError(error, embeddingsLoader, embeddingsError, timerId);
	}
}

function displayEmbeddingsResults(results) {
	embeddingsResults.innerHTML = results
		.map((doc, index) => {
			const scorePercent = (doc.score * 100).toFixed(1);

			return `
            <div class="embedding-item" style="animation-delay: ${index * 0.1}s">
                <div class="embedding-header">
                    <a href="https://www.librarything.com/mds/${doc.number}" target="_blank" rel="noopener noreferrer" class="embedding-number">${doc.number}</a>
                    <div class="embedding-score">${scorePercent}%</div>
                </div>
                <div class="embedding-title">${doc.name}</div>
                <div class="embedding-breadcrumb">${doc.breadcrumb}</div>
            </div>
        `;
		})
		.join('');

	embeddingsResults.classList.add('visible');
}

async function searchGPT(query) {
	const startTime = performance.now();
	const timerId = startRealtimeTimer('gptTime', startTime);

	try {
		const response = await fetch(`/api/classify/gpt?query=${encodeURIComponent(query)}`);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const contentType = response.headers.get('content-type');

		if (contentType && contentType.includes('application/json')) {
			const result = await response.json();
			clearInterval(timerId);
			const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
			updateTimeBadge('gptTime', elapsedTime);
			gptLoader.classList.add('hidden');
			displayFinalGPTResult(result);
			return;
		}

		gptLoader.classList.add('hidden');
		gptProgress.classList.add('visible');

		gptProgress.innerHTML = `
			<div class="progress-step placeholder">
				<div class="step-icon">?</div>
				<div class="step-content">
					<div class="step-label">Analyzing...</div>
					<div class="step-value">Waiting for classification</div>
				</div>
			</div>
		`;

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		const updates = [];

		while (true) {
			const { done, value } = await reader.read();

			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.trim()) {
					try {
						const update = JSON.parse(line);
						updates.push(update);
						displayGPTProgress(updates);

						if (update.finished) {
							clearInterval(timerId);
							const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
							updateTimeBadge('gptTime', elapsedTime);
							displayFinalGPTResult(update);
						}
					} catch (e) {
						console.error('Failed to parse line:', line, e);
					}
				}
			}
		}
	} catch (error) {
		gptProgress.classList.add('hidden');
		handleAPIError(error, gptLoader, gptError, timerId);
	}
}

function displayGPTProgress(updates) {
	const reversedUpdates = [...updates].reverse();

	const stepsHTML = reversedUpdates
		.map((update, index) => {
			const isFirst = index === 0;
			const originalIndex = updates.length - index;
			return `
            <div class="progress-step ${isFirst ? 'active' : ''}">
                <a href="https://www.librarything.com/mds/${update.number}" target="_blank" rel="noopener noreferrer" class="step-icon">${update.number}</a>
                <div class="step-content">
                    <div class="step-label">Classification ${originalIndex}</div>
                    <div class="step-value">${update.name}</div>
                    <div class="step-breadcrumb">${update.breadcrumb}</div>
                </div>
            </div>
        `;
		})
		.join('');

	const lastUpdate = updates[updates.length - 1];
	const placeholderHTML = !lastUpdate?.finished
		? `
		<div class="progress-step placeholder active">
			<div class="step-icon">?</div>
			<div class="step-content">
				<div class="step-label">Next classification...</div>
				<div class="step-value">Processing</div>
			</div>
		</div>
	`
		: '';

	gptProgress.innerHTML = placeholderHTML + stepsHTML;
}

function displayFinalGPTResult(result) {
	const fullPath = `${result.breadcrumb ? `${result.breadcrumb} > ` : ''}${result.name}`;

	gptResults.innerHTML = `
        <div class="final-result">
            <div class="final-result-label">Final Classification</div>
            <a href="https://www.librarything.com/mds/${result.number}" target="_blank" rel="noopener noreferrer" class="final-result-number">${result.number}</a>
            <div class="final-result-name">${result.name}</div>
            <div class="final-result-path">${fullPath}</div>
        </div>
    `;

	gptResults.classList.add('visible');
}

function updateTimeBadge(elementId, seconds) {
	const badge = document.getElementById(elementId);
	if (badge) {
		badge.textContent = `${seconds}s`;
		badge.style.display = 'inline-block';
	}
}

function startRealtimeTimer(elementId, startTime) {
	const badge = document.getElementById(elementId);
	if (badge) {
		badge.style.display = 'inline-block';
	}

	return setInterval(() => {
		const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
		updateTimeBadge(elementId, elapsed);
	}, 50);
}

if ('scrollRestoration' in history) {
	history.scrollRestoration = 'manual';
}

window.scrollTo(0, 0);
queryInput.focus();
