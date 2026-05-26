![Product Logo](https://github.com/harikshore/Webflow-Collection-De-Referencer/blob/33111fd734991c58e679d432f5e1dba0e916f5ab/CollectionDeReferencer.png)

# Webflow Collection De-Referencer

This simple script helps you de-reference all reference/multi-reference fields in given webflow collections after which you can easily delete bulk items from them.

## Why

Deleting webflow collection items that have reference/multi-reference fields is a nightmare. When Items in a collection are referencing an item in another collection or is being referenced by an item in another collection, You can only delete the item after these references are de-referenced. 

This simple script helps you de-reference all reference/multi-reference fields in given webflow collections after which you can easily delete bulk items from these collections.

## ⚠️ Before You Begin: Create a Site Backup

**Always back up your Webflow site before running this tool.** This script makes bulk changes to your CMS data that cannot be automatically undone. A backup ensures you can restore your content if something goes wrong.

## Usage 

### Installation

1. Clone this repository,
2. Open the repository folder in a code editor like VS Code.
3. then run:

```
npm install
```
Or if you prefer to use yarn, you can run:

```bash
yarn install
``` 

### Running the tool

1. Run:

```
npm start
```
Or

```
yarn start
```

### Commands 

First, get an API key for your Webflow site.

1. Go to your Webflow Dashboard.
2. Click the three dots on the desired Webflow site.
3. Click "Settings".
4. Click "Apps & Integrations".
5. Click "Generate API Token". (Important: make sure to pick the v2 API token, the blue button).
6. Under the "Generate API Token" dialog, give a name and grant "read and write" permissions for CMS & Sites.
7. Click "Generate Token"
8. Copy the API token and store it somewhere safe for later.

Get the Collection Ids of the collection to be de-referenced.

1. In your webflow designer, Open your CMS Panel
2. Open the Collection settings of the collection and copy the collection id. 
3. Copy the collection ids of all the collections you want to de-reference and store it somewhere for later.

After the tool is running successfully,

Input the API Key where it says: 
```
Enter your Webflow API token:
```

Then, Input the collection ids in a comma seperated fashion: 
```
Enter your Webflow collection IDs (comma separated):
```

It can be one or more collections.

Hit Enter

## Output

Sit back and relax while the script processes each collection and de-references the items in them. 

After de-referencing is complete, you can go into each collection and delete items 100 by 100 at a time if you want. And publish your site in the designer. This is very easier and time saving.

## Updates
### Released
#### v1.0.5
- Fixed crashes on large collections by adding automatic rate limit handling.

### Planned
- Handle de-referencing items in different cms locales.
- Batch update of collection items instead of individual item update
- Add devlog.md

# Share your love

- Product Hunt: https://www.producthunt.com/products/webflow-collection-de-referencer

# Follow the creator
- Twitter: https://x.com/harikshore15,
- Email: harikshoresridharan@gmail.com
