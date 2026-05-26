import fetch from 'node-fetch';
import readline from 'readline';

async function withRetry(fn, { maxRetries = 5, baseDelayMs = 1000 } = {}) {
  let attempt = 0;

  while (true) {
    const { response, data } = await fn();

    if (response.status < 400) {
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

async function getSiteDetails(token) {
  const data = await fetchWebflowAPI('https://api.webflow.com/v2/sites', undefined, undefined, token);
  const site = data.sites[0];

  // Build a flat ordered list of all locales: primary first, then secondary
  const allLocales = [
    { displayName: site.locales.primary.displayName, cmsLocaleId: site.locales.primary.cmsLocaleId, isPrimary: true },
    ...site.locales.secondary.map(l => ({ displayName: l.displayName, cmsLocaleId: l.cmsLocaleId, isPrimary: false })),
  ];

  return { siteId: site.id, displayName: site.displayName, allLocales };
}

async function getCollectionDetails(collectionId, token) {
  const url = `https://api.webflow.com/v2/collections/${collectionId}`;
  const collection = await fetchWebflowAPI(url, undefined, undefined, token);
  // Return objects containing both type and slug for each relevant field
  return collection.fields
    .filter(field => field.type === 'Reference' || field.type === 'MultiReference')
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
    total = response.pagination.total;
    offset += 100;
  } while (offset < total);

  return items;
}

async function dereferenceCollectionItems(collectionId, items, referenceFields, cmsLocaleIds, token) {
  const fieldData = {};
  for (const field of referenceFields) {
    fieldData[field.slug] = field.type === 'MultiReference' ? [] : '';
  }

  // Build one entry per item × locale (or just one entry per item for primary locale)
  const entries = [];
  for (const item of items) {
    if (cmsLocaleIds.length === 0) {
      entries.push({ id: item.id, isArchived: false, isDraft: false, fieldData });
    } else {
      for (const localeId of cmsLocaleIds) {
        entries.push({ id: item.id, cmsLocaleId: localeId, isArchived: false, isDraft: false, fieldData });
      }
    }
  }

  const url = `https://api.webflow.com/v2/collections/${collectionId}/items`;
  const totalBatches = Math.ceil(entries.length / 100);

  for (let i = 0; i < entries.length; i += 100) {
    const batch = entries.slice(i, i + 100);
    const batchNum = Math.floor(i / 100) + 1;
    console.log(`  PATCH batch ${batchNum}/${totalBatches} (${batch.length} entries)...`);
    await fetchWebflowAPI(url, 'PATCH', { items: batch }, token);
  }
}

async function run() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (question) => new Promise(resolve => rl.question(question, resolve));

  console.log('======================================');
  console.log('⛓️‍💥 WEBFLOW COLLECTION DE-REFERENCER ⛓️‍💥');
  console.log('======================================');
  console.log('\n');

  // ── Step 1: Backup gate ────────────────────────────────────────────────────
  const backup = await ask('Have you created a backup of your Webflow site? (yes/no): ');
  if (!['yes', 'y'].includes(backup.trim().toLowerCase())) {
    console.log('Aborted. Please create a site backup before proceeding.');
    rl.close();
    return;
  }

  // ── Step 2: API token ──────────────────────────────────────────────────────
  const token = await ask('Enter your Webflow API token: ');

  // ── Step 3: Collection IDs ─────────────────────────────────────────────────
  const collectionIdsRaw = await ask('Enter your Webflow collection IDs (comma separated): ');
  const collectionIds = collectionIdsRaw.split(',').map(id => id.trim()).filter(Boolean);

  if (collectionIds.length === 0) {
    console.log('✗ No collection IDs provided. Aborted.');
    rl.close();
    return;
  }

  // ── Step 4: Fetch site details & locale selection ──────────────────────────
  console.log('\nFetching site details...');
  const { displayName, allLocales } = await getSiteDetails(token);

  console.log(`\nSite: ${displayName}`);
  console.log('\nAvailable locales:');
  allLocales.forEach((locale, index) => {
    const label = locale.isPrimary ? `${locale.displayName} (primary)` : locale.displayName;
    console.log(`  ${index + 1}. ${label}`);
  });

  const localeSelectionRaw = await ask('\nEnter locale numbers to de-reference (comma separated, or leave blank for primary locale only): ');
  rl.close();

  let cmsLocaleIds;

  if (localeSelectionRaw.trim() === '') {
    // Primary locale only — omit cmsLocaleIds entirely (Webflow API default)
    cmsLocaleIds = [];
    console.log('\nNo locale selected — de-referencing primary locale only.\n');
  } else {
    const selectedIndices = localeSelectionRaw.split(',').map(s => parseInt(s.trim(), 10) - 1);
    const invalidIndices = selectedIndices.filter(i => i < 0 || i >= allLocales.length || isNaN(i));

    if (invalidIndices.length > 0) {
      console.error(`✗ Invalid locale selection. Please enter numbers between 1 and ${allLocales.length}.`);
      return;
    }

    cmsLocaleIds = selectedIndices.map(i => allLocales[i].cmsLocaleId);
    const selectedNames = selectedIndices.map(i => allLocales[i].displayName);
    console.log(`\nDe-referencing locales: ${selectedNames.join(', ')}\n`);
  }

  // ── Step 5: Process each collection ───────────────────────────────────────
  for (const collectionId of collectionIds) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Processing collection: ${collectionId}`);
    console.log('─'.repeat(60));

    try {
      const referenceFields = await getCollectionDetails(collectionId, token);

      if (referenceFields.length === 0) {
        console.log('⚠ No Reference or MultiReference fields found in this collection. Skipping.');
        continue;
      }

      console.log(`Reference fields: [${referenceFields.map(f => f.slug).join(', ')}]`);

      const items = await listCollectionItems(collectionId, token);
      console.log(`Fetched ${items.length} items.`);

      if (items.length === 0) {
        console.log('Collection has no items. Skipping.');
        continue;
      }

      await dereferenceCollectionItems(collectionId, items, referenceFields, cmsLocaleIds, token);
      console.log(`✓ De-referenced ${collectionId} successfully.`);
    } catch (error) {
      console.error(`✗ Error processing collection ${collectionId}:`, error.message);
    }
  }

  console.log('\nDone.');
}

run();