import fetch from 'node-fetch';
import readline from 'readline';

async function withRetry(fn, { maxRetries = 5, baseDelayMs = 1000 } = {}) {
  let attempt = 0;

  while (true) {
    const { response, data } = await fn();

    if (response.status < 400)  {
      console.log(`  → ${response.status}`);
      return data;
    }

    if (response.status === 429) {
      if (attempt >= maxRetries) {
        throw new Error(`Rate limit persists after ${maxRetries} retries. Giving up.`);
      }
      const retryAfter = response.headers.get('retry-after');
      const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : Math.min(60000, baseDelayMs * 2 ** attempt);
      console.warn(`⚠ Rate limited. Waiting ${(waitMs / 1000).toFixed(1)}s before retry (attempt ${attempt + 1}/${maxRetries})...`);
      await sleep(waitMs);
      attempt++;
      continue;
    }

    if (response.status >= 500) {
      if (attempt >= maxRetries) {
        throw new Error(`Server error ${response.status} persists after ${maxRetries} retries.`);
      }
      const waitMs = baseDelayMs * 2 ** attempt;
      console.warn(`⚠ Server error ${response.status}. Retrying in ${(waitMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})...`);
      await sleep(waitMs);
      attempt++;
      continue;
    }

    // Non-retryable error (4xx excluding 429)
    throw new Error(`API error ${response.status}: ${JSON.stringify(data)}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWebflowAPI(url, method = 'GET', body = null, token) {
  const headers = {
    'authorization': `Bearer ${token}`,
    'accept-version': '2.0.0',
    'Content-Type': 'application/json',
    'accept': 'application/json'
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  return withRetry(async () => {
    const response = await fetch(url, options);
    const data = await response.json();
    return { response, data };
  });
}

async function getCollectionDetails(collectionId, token) {
  const url = `https://api.webflow.com/v2/collections/${collectionId}`;
  const collection = await fetchWebflowAPI(url, undefined, undefined, token);
  // Return objects containing both type and slug for each relevant field
  return collection.fields.filter(field => field.type === 'Reference' || field.type === 'MultiReference')
    .map(field => ({ type: field.type, slug: field.slug }));
}

async function listCollectionItems(collectionId, token) {
  let items = [];
  let offset = 0;
  let total = 0;

  do {
    const url = `https://api.webflow.com/v2/collections/${collectionId}/items?offset=${offset}&limit=100`;
    const response = await fetchWebflowAPI(url, undefined, undefined, token);
    items = items.concat(response.items);
    total = response.pagination.total; // Total number of items
    offset += 100;
  } while (offset < total);

  return items;
}

async function updateCollectionItems(collectionId, items, referenceFields, token) {
  for (const item of items) {
    const updates = {};

    referenceFields.forEach(field => {
      if (field.type === 'Reference') {
        updates[field.slug] = '';
      } else if (field.type === 'MultiReference') {
        updates[field.slug] = [];
      }
    });

    const url = `https://api.webflow.com/v2/collections/${collectionId}/items/${item.id}`;
    await fetchWebflowAPI(url, 'PATCH', { isArchived: false, isDraft: false, fieldData: updates }, token);
    console.log(`Updated item ${item.fieldData.name}`);
  }
}

async function run() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter your Webflow API token: ', async (token) => {
    rl.question('Enter your Webflow collection IDs (comma separated): ', async (collectionIds) => {
      const collectionIdArray = collectionIds.split(',').map(id => id.trim());
      rl.close();
      
      for (const collectionId of collectionIdArray) {
        try {
          console.log(`Processing collection ID: ${collectionId}`);
          const referenceFields = await getCollectionDetails(collectionId, token);
          console.log('Reference Fields:', referenceFields);

          const items = await listCollectionItems(collectionId, token);
          console.log(`Fetched ${items.length} items from the collection`);

          await updateCollectionItems(collectionId, items, referenceFields, token);
        } catch (error) {
          console.error(`Error during operation for collection ID ${collectionId}:`, error);
        }
      }
    });
  });
}

run();