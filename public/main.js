async function getDeweyDecimalData(prompt) {
    const response = await fetch('/api/getDeweyData.js', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// Grab reference to the necessary elements.
const searchBar = document.querySelector('#search-bar');
const searchForm = document.querySelector('#search-form');
const resultContainer = document.querySelector('#result-container');
const defaultTipArea = document.querySelector('.tip-area');
const container = document.querySelector('.container');
const retryButton = document.querySelector('#retry-button');

// Get the query parameter from the URL
const urlParams = new URLSearchParams(window.location.search);
const queryParam = urlParams.get('q');

// Check if the query parameter exists
if (queryParam) {
  searchBar.value = queryParam;
  setTimeout(() => {
    searchForm.dispatchEvent(new Event('submit'));
  }, 0);
}

// Add event listener for 'search' event.
searchForm.addEventListener('submit', async (event) => {
	// Prevent form from being submitted normally.
	event.preventDefault();

	retryButton.classList.remove('hidden');

	// Clear previous results.
	resultContainer.innerHTML = '';

    // Display a loading message and disable the search bar.
    const loadingText = document.createElement('p');
	loadingText.classList.add('result');
    loadingText.textContent = 'Loading...';

	const generatedTipAreas = document.querySelectorAll('.tip-area.generated');
	generatedTipAreas.forEach((tipArea) => {
		tipArea.remove();
	});

    resultContainer.appendChild(loadingText);
    searchBar.disabled = true;

	try {
	  	// Fetch Dewey Decimal data.
	  	const data = await getDeweyDecimalData(searchBar.value);
		console.log({ data });

		// Clear loading text.
		resultContainer.innerHTML = '';

		// Create a new <p> element for each result and append it to the result container.
		data.results.forEach((result, idx) => {
			const resultText = document.createElement('p');
			const breadcrumb = document.createElement('div');

			breadcrumb.classList.add("breadcrumb");
			breadcrumb.dataset.tooltip = result.breadcrumb;

			resultText.classList.add('result');
			const resultTextContent = document.createElement('a');
			resultTextContent.textContent = `${result.number} ${result.label}`;
			resultText.appendChild(resultTextContent);

			if (idx === 0) {
				resultText.classList.add('best-match');
			}

			breadcrumb.appendChild(resultText);
			resultContainer.appendChild(breadcrumb);
		});

		// Update the low confidence explanation if applicable.
	  	if (data.context) {
			const contextText = document.createElement('p');

			contextText.id = 'context';
			contextText.textContent = data.context;

			resultContainer.appendChild(contextText);
	  	}

		if (data.tip) {
			const tipArea = document.createElement('div');
			tipArea.classList.add('tip-area', 'generated');

			container.insertBefore(tipArea, defaultTipArea);

			const tipText = document.createElement('p');

			tipText.textContent = `💡 ${data.tip}`;
			tipArea.appendChild(tipText);
		}
	} catch (error) {
		// Handle any errors.
		console.error(error);

		resultContainer.innerHTML = '';
		const resultText = document.createElement('p');

		resultText.classList.add('result');
		resultText.textContent = 'An error occurred.';

		resultContainer.appendChild(resultText);
	} finally {
		// Re-enable the search bar after loading is complete.
		searchBar.disabled = false;
	}
});

searchBar.addEventListener('input', () => {
	const newURL = new URL(window.location.href);
	newURL.searchParams.set('q', searchBar.value);
	history.replaceState(null, null, newURL.toString());
  });

retryButton.addEventListener('click', () => {
	window.location.reload();
});
