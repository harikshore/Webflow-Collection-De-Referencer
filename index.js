import fetch from 'node-fetch';
import readline from 'readline';

// Helper function to fetch data from Webflow API
async function fetchWebflowAPI(url, method = 'GET', body = null, token) {
  const headers = {
    'authorization': `Bearer ${token}`,
    'accept-version': '2.0.0',
    'Content-Type': 'application/json',
    'accept': 'application/json'
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  return response.json();
}

// Action 1: Get Collection Details and identify reference fields
async function getCollectionDetails(collectionId, token) {
  const url = `https://api.webflow.com/v2/collections/${collectionId}`;
  const collection = await fetchWebflowAPI(url, undefined, undefined, token);
  // Return objects containing both type and slug for each relevant field
  return collection.fields.filter(field => field.type === 'Reference' || field.type === 'MultiReference')
    .map(field => ({ type: field.type, slug: field.slug }));
}

// Action 2: List all collection items
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

// Action 3: Update collection items
async function updateCollectionItems(collectionId, items, referenceFields, token) {
  for (const item of items) {
    const updates = {};

    referenceFields.forEach(field => {
      if (field.type === 'Reference') {
        updates[field.slug] = '';  // Set Reference fields to empty string
      } else if (field.type === 'MultiReference') {
        updates[field.slug] = [];  // Set Multi-Reference fields to empty array
      }
    });

    const url = `https://api.webflow.com/v2/collections/${collectionId}/items/${item.id}`;
    await fetchWebflowAPI(url, 'PATCH', { isArchived: false, isDraft: false, fieldData: updates }, token);
    console.log(`Updated item ${item.fieldData.name}`);
  }
}

// Main function to run the script
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