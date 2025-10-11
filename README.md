# decimeta

![Demo](https://i.imgur.com/RShz1gn.gif)

Evaluates the Dewey Decimal System classification for a given query. Since the DDS
is closed-source and copyrighted, this project scrapes [data](./mds.json) from the Melvil
Decimal System, which is the next best things. [(Learn more)](https://www.librarything.com/mds).

## How It Works

Decimeta uses two complementary approaches to classify queries:

1. Compares query embeddings against a vector database of MDS classifications
   using OpenAI's text-embedding-3-small model and Pinecone. If the query
   has something to do with its topic, this search works well. However, it may
   miss nuances or context.

2. Uses OpenAI's GPT-4.1 to navigate the classification hierarchy step-by-step,
   narrowing from hundreds to tens to ones place (and into decimals if needed).
   GPT is prone to hallucinating DDC numbers, which is why we must give it
   concrete options. GPT-4.1 was picked as it is the cheapest and fastest
   non-reasoning model.

## Setup

Install dependencies:

```bash
bun install
```

Set environment variables:

```bash
OPENAI_API_KEY=your_key_here
PINECONE_API_KEY=your_key_here
```

## Usage

Scrape MDS data (this is slow and intensive for
[LibraryThing](https://www.librarything.com/mds). Please use sparingly!):

```bash
bun run scrape
```

Generate and store embeddings (this will also take a while):

```bash
bun run vectorize
```

Start the server:

```bash
bun start
```

The web interface will be available at `http://localhost:3000`. It will use the
API routes `/api/classify/gpt?query=your_query` and `/api/classify/embeddings?query=your_query`.
