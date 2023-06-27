// citelight.js
const Cite = require('citation-js');

async function handleFileUpload(event) {
    const file = event.target.files[0];
    const text = await file.text();
    const entries = await parseBibTeX(text);

    const originalTitles = entries.map(entry => entry.title);

    const foundationPapers = {};
    const similarPapers = {};

    // Update progress bar to show total number of papers
    const progressBarText = document.getElementById('progressBarText');
    progressBarText.textContent = `0 / ${entries.length} papers processed`;

    // Show spinner
    const spinner = document.getElementById('spinner');
    spinner.style.display = 'block';

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const data = await getPaperData(entry.title);
        if (!data) {
            console.error(`No results found for title: ${entry.title}`);
            continue;
        }
        for (const citation of data.citations) {
            similarPapers[citation.paperId] = {
                count: (similarPapers[citation.paperId]?.count || 0) + 1,
                title: citation.title,
                url: citation.url,
                isNew: !isSamePaper(citation.title, originalTitles)
            };
        }
        for (const reference of data.references) {
            foundationPapers[reference.paperId] = {
                count: (foundationPapers[reference.paperId]?.count || 0) + 1,
                title: reference.title,
                url: reference.url,
                isNew: !isSamePaper(reference.title, originalTitles)
            };
        }
        updateProgressBar(i + 1, entries.length);
    }

    // Hide spinner
    spinner.style.display = 'none';

    displayPapers(foundationPapers, 'foundationalResults');
    displayPapers(similarPapers, 'similarResults');
}

function isSamePaper(title, originalTitles) {
    const wordsInTitle = new Set(title.toLowerCase().split(' '));
    for (const originalTitle of originalTitles) {
        const wordsInOriginalTitle = new Set(originalTitle.toLowerCase().split(' '));
        const intersection = new Set([...wordsInTitle].filter(word => wordsInOriginalTitle.has(word)));
        const union = new Set([...wordsInTitle, ...wordsInOriginalTitle]);
        const jaccardSimilarity = intersection.size / union.size;
        if (jaccardSimilarity > 0.5) { // You can adjust this threshold to balance between false positives and false negatives.
            return true;
        }
    }
    return false;
}

function displayPapers(papers, elementId) {
    const element = document.getElementById(elementId);
    const sortedPapers = Object.entries(papers).sort((a, b) => b[1].count - a[1].count).slice(0, 20);

    for (const [paperId, paper] of sortedPapers) {
        const div = document.createElement('div');
        div.innerHTML = `<a href="${paper.url}">${paper.title}</a> (${paper.count})`;
        if (paper.isNew) {
            div.classList.add('new-paper');
        }
        element.appendChild(div);
    }
}

function updateProgressBar(current, total) {
    const fillElement = document.getElementById('progressBarFill');
    const textElement = document.getElementById('progressBarText');
    const percentage = Math.floor((current / total) * 100);
    fillElement.style.width = `${percentage}%`;
    fillElement.setAttribute('aria-valuenow', percentage);
    textElement.textContent = `${current} / ${total} papers processed`;
}

async function parseBibTeX(text) {
    const cite = new Cite(text);
    const titles = cite.data.map(entry => ({ title: entry.title }));
    return titles;
}

async function getPaperData(title) {
    // Construct the API request URL
    const apiUrl = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
    title = title.replace(/\W/g, ' ');
    apiUrl.searchParams.append('query', title);
    apiUrl.searchParams.append('limit', 1);
    apiUrl.searchParams.append('fields', 'paperId,citations,citations.url,citations.title,references,references.url,references.title,title,url');

    // Perform the API request
    const response = await fetch(apiUrl.href);

    if (response.ok) {
        // If the request was successful, parse the JSON response
        const data = await response.json();
        // Return the data of the first paper in the data field
        if (data && data.data && data.data.length > 0) {
            const paperData = data.data[0];
             // Check if references or citations are problematic
             paperData.references = paperData.references.filter(ref => ref.paperId);
             paperData.citations = paperData.citations.filter(cit => cit.paperId);
            return paperData;
        } else {
            console.log('No results found for title:', title);
            console.log('API response:', data);
        }
    } else {
        console.log('API request not successful for title:', title);
        console.log('Status:', response.status);
        console.log('Status text:', response.statusText);
    }

    // If there was an error or no results, return null
    return null;
}