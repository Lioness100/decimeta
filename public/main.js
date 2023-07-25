// Grab reference to the necessary elements.
const searchBar = document.querySelector('#search-bar');
const searchForm = document.querySelector('#search-form');
const resultContainer = document.querySelector('#result-container');
const container = document.querySelector('.container');

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

function distanceToPercentage(score) {
    // tolerance value for numerical precision
    const epsilon = 1e-5;

    // treat very small values as zero
    if (Math.abs(score) < epsilon) {
        score = 0;
    }

    if(score < 0 || score > 2) {
        throw new Error("Invalid score. Score should be between 0 and 2.");
    }

    // Convert the distance to similarity. Lower distance means higher similarity
    let similarity = 2 - score;

    // Convert the similarity to percentage. Similarity of 2 is 100%, similarity of 0 is 0%.
    let percentage = (similarity / 2) * 100;

    return percentage.toFixed(2) + "%";
}

// Add event listener for 'search' event.
searchForm.addEventListener('submit', async (event) => {
	// Prevent form from being submitted normally.
	event.preventDefault();

	// Clear previous results.
	resultContainer.innerHTML = '';

    // Display a loading message and disable the search bar.
    const loadingText = document.createElement('p');
	loadingText.classList.add('result');
    loadingText.textContent = 'Loading...';

    resultContainer.appendChild(loadingText);
    searchBar.disabled = true;

	try {
	  	// Fetch Dewey Decimal data.
	  	const docs = await fetch(`/api/searchForMDS.js?search=${searchBar.value}`).then((res) => res.json());
		console.log({ docs });

		// Clear loading text.
		resultContainer.innerHTML = '';

		// Create a new <p> element for each result and append it to the result container.
		docs.forEach(([doc, score], idx) => {
			const resultText = document.createElement('p');
			const breadcrumb = document.createElement('div');

			breadcrumb.classList.add("breadcrumb");
			breadcrumb.dataset.tooltip = doc.metadata.breadcrumb;

			resultText.classList.add('result');
			const resultTextContent = document.createElement('a');

			if (window.matchMedia('(hover: hover)').matches) {
				const number = doc.pageContent.split(' ')[0];
				resultTextContent.href = `https://librarything.com/mds/${number}`;
				resultTextContent.target = '_blank';
			}

			resultTextContent.textContent = doc.pageContent;
			resultText.appendChild(resultTextContent);

			if (idx === 0) {
				resultText.classList.add('best-match');
			}

			// Create a new <span> element for displaying the match percentage.
  			const matchPercentage = document.createElement('span');
  			matchPercentage.classList.add('match-percentage');
			console.log(score);
  			matchPercentage.textContent = `${(score * 100).toFixed(2)}%`;

  			// Append the match percentage to the result element.
  			resultText.appendChild(matchPercentage);

			breadcrumb.appendChild(resultText);
			resultContainer.appendChild(breadcrumb);
		});
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
