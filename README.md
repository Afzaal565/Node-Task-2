# Google Search API

A simple Node.js/Express API that uses Puppeteer to search Google and return the first 10 search result titles.

## Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
node app.js
```

2. Make a GET request to the search endpoint:
```
GET http://localhost:3001/search?query=your search query
```

### Example Response

```json
{
    "query": "your search query",
    "results": [
        "First search result title",
        "Second search result title",
        ...
    ]
}
```

## Dependencies

- Express.js
- Puppeteer