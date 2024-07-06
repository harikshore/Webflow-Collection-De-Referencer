# Webflow Collection De-Referencer

This simple script helps you de-reference all reference/multi-reference fields in given webflow collections after which you can easily delete bulk items from them.

## Why

Deleting webflow collection items that have reference/multi-reference fields is a nightmare. When Items in a collection are referencing an item in another collection or is being referenced by an item in another collection, You can only delete the item after these references are de-referenced. 

This simple script helps you de-reference all reference/multi-reference fields in given webflow collections after which you can easily delete bulk items from these collections.

## Usage 

### Installation

Clone this repository, then run: 

```bash
yarn install
```

Or if you prefer to use npm, you can run: 

```
npm install
```

Finally run: 

```
yarn start
```

Or 

```
npm start
```

### Commands 

First, get an API key for your Webflow site.

1. Go to your Webflow Dashboard.
2. Click the three dots on a Webflow site.
3. Click "Settings".
4. Click "Apps & Integrations".
5. Click "Generate Legacy API Token". (Important: make sure to pick the legacy API token)
6. Copy the API token and store it somewhere safe for later.

Get the Collection Ids of the collection to be de-referenced.

1. In your webflow designer, Open your CMS Panel
2. Open the Collection settings of the collection and copy the collection id. 
3. Copy the collection ids of all the collections you want to de-reference and store it somewhere for later.

After `yarn start` successful,

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
