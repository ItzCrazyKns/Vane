# Vane Search API Documentation

## Overview

Vane's Search API makes it easy to use our AI-powered search engine. You can run different types of searches, pick the models you want to use, and get the most recent info. Follow the following headings to learn more about Vane's search API.

## ⚠️ Migration Guide

### v1.12.1: `focusMode` replaced by `sources`

The `focusMode` parameter has been removed from all API endpoints and replaced with `sources`.

| Before (v1.12.0 and earlier) | After (v1.12.1+) |
|------------------------------|-------------------|
| `"focusMode": "webSearch"` | `"sources": ["web"]` |
| `"focusMode": "academicSearch"` | `"sources": ["academic"]` |

> **⚠️ Breaking change in v1.12.1:** The `focusMode` parameter has been removed.
> Replace `focusMode: "webSearch"` with `sources: ["web"]` in all integrations.
>
> **Behaviour by endpoint:**
> - `/api/chat` — `focusMode` is stripped by Zod schema validation and `sources`
>   defaults to `[]`. No error is returned, but no sources are searched. Queries
>   appear to work but return LLM-only answers with no web data.
> - `/api/search` — `focusMode` is not accepted. Sending `focusMode` without `sources`
>   returns **HTTP 400** `Missing sources or query`.

## Endpoints

### Get Available Providers and Models

Before making search requests, you'll need to get the available providers and their models.

#### **GET** `/api/providers`

**Full URL**: `http://localhost:3000/api/providers`

Returns a list of all active providers with their available chat and embedding models.

**Response Example:**

```json
{
  "providers": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "OpenAI",
      "chatModels": [
        {
          "name": "GPT 4 Omni Mini",
          "key": "gpt-4o-mini"
        },
        {
          "name": "GPT 4 Omni",
          "key": "gpt-4o"
        }
      ],
      "embeddingModels": [
        {
          "name": "Text Embedding 3 Large",
          "key": "text-embedding-3-large"
        }
      ]
    }
  ]
}
```

Use the `id` field as the `providerId` and the `key` field from the models arrays when making search requests.

### Search Query

#### **POST** `/api/search`

**Full URL**: `http://localhost:3000/api/search`

**Note**: Replace `localhost:3000` with your Vane instance URL if running on a different host or port

### Request

The API accepts a JSON object in the request body, where you define the enabled search `sources`, chat models, embedding models, and your query.

#### Request Body Structure

```json
{
  "chatModel": {
    "providerId": "550e8400-e29b-41d4-a716-446655440000",
    "key": "gpt-4o-mini"
  },
  "embeddingModel": {
    "providerId": "550e8400-e29b-41d4-a716-446655440000",
    "key": "text-embedding-3-large"
  },
  "optimizationMode": "speed",
  "sources": ["web"],
  "query": "What is Vane",
  "history": [
    ["human", "Hi, how are you?"],
    ["assistant", "I am doing well, how can I help you today?"]
  ],
  "systemInstructions": "Focus on providing technical details about Vane's architecture.",
  "stream": false
}
```

**Note**: The `providerId` must be a valid UUID obtained from the `/api/providers` endpoint. The example above uses a sample UUID for demonstration.

### Request Parameters

- **`chatModel`** (object, required): Defines the chat model to be used for the query. To get available providers and models, send a GET request to `http://localhost:3000/api/providers`.

  - `providerId` (string): The UUID of the provider. You can get this from the `/api/providers` endpoint response.
  - `key` (string): The model key/identifier (e.g., `gpt-4o-mini`, `llama3.1:latest`). Use the `key` value from the provider's `chatModels` array, not the display name.

- **`embeddingModel`** (object, required): Defines the embedding model for similarity-based searching. To get available providers and models, send a GET request to `http://localhost:3000/api/providers`.

  - `providerId` (string): The UUID of the embedding provider. You can get this from the `/api/providers` endpoint response.
  - `key` (string): The embedding model key (e.g., `text-embedding-3-large`, `nomic-embed-text`). Use the `key` value from the provider's `embeddingModels` array, not the display name.

- **`sources`** (array, required): Which search sources to enable. Available values:

  - `web`, `academic`, `discussions`.

- **`optimizationMode`** (string, optional): Specifies the optimization mode to control the balance between performance and quality. Available modes:

  - `speed`: Prioritize speed and return the fastest answer.
  - `balanced`: Provide a balanced answer with good speed and reasonable quality.
  - `quality`: Prioritize answer quality (may be slower).

- **`query`** (string, required): The search query or question.

- **`systemInstructions`** (string, optional): Custom instructions provided by the user to guide the AI's response. These instructions are treated as user preferences and have lower priority than the system's core instructions. For example, you can specify a particular writing style, format, or focus area.

- **`history`** (array, optional): An array of message pairs representing the conversation history. Each pair consists of a role (either 'human' or 'assistant') and the message content. This allows the system to use the context of the conversation to refine results. Example:

  ```json
  [
    ["human", "What is Vane?"],
    ["assistant", "Vane is an AI-powered search engine..."]
  ]
  ```

- **`stream`** (boolean, optional): When set to `true`, enables streaming responses. Default is `false`.

### Response

The response from the API includes both the final message and the sources used to generate that message.

#### Standard Response (stream: false)

```json
{
  "message": "Vane is an innovative, open-source AI-powered search engine designed to enhance the way users search for information online. Here are some key features and characteristics of Vane:\n\n- **AI-Powered Technology**: It utilizes advanced machine learning algorithms to not only retrieve information but also to understand the context and intent behind user queries, providing more relevant results [1][5].\n\n- **Open-Source**: Being open-source, Vane offers flexibility and transparency, allowing users to explore its functionalities without the constraints of proprietary software [3][10].",
  "sources": [
    {
      "content": "Vane is an innovative, open-source AI-powered search engine designed to enhance the way users search for information online.",
      "metadata": {
        "title": "What is Vane, and how does it function as an AI-powered search ...",
        "url": "https://askai.glarity.app/search/What-is-Vane--and-how-does-it-function-as-an-AI-powered-search-engine"
      }
    },
    {
      "content": "Vane is an open-source AI-powered search tool that dives deep into the internet to find precise answers.",
      "metadata": {
        "title": "Sahar Mor's Post",
        "url": "https://www.linkedin.com/posts/sahar-mor_a-new-open-source-project-called-vane-activity-7204489745668694016-ncja"
      }
    }
        ....
  ]
}
```

#### Streaming Response (stream: true)

When streaming is enabled, the API returns a stream of newline-delimited JSON objects using Server-Sent Events (SSE). Each line contains a complete, valid JSON object. The response has `Content-Type: text/event-stream`.

Example of streamed response objects:

```
{"type":"init","data":"Stream connected"}
{"type":"sources","data":[{"content":"...","metadata":{"title":"...","url":"..."}},...]}
{"type":"response","data":"Vane is an "}
{"type":"response","data":"innovative, open-source "}
{"type":"response","data":"AI-powered search engine..."}
{"type":"done"}
```

Clients should process each line as a separate JSON object. The different message types include:

- **`init`**: Initial connection message
- **`sources`**: All sources used for the response
- **`response`**: Chunks of the generated answer text
- **`done`**: Indicates the stream is complete

### Fields in the Response

- **`message`** (string): The search result, generated based on the query and enabled `sources`.
- **`sources`** (array): A list of sources that were used to generate the search result. Each source includes:
  - `content`: A snippet of the relevant content from the source.
  - `metadata`: Metadata about the source, including:
    - `title`: The title of the webpage.
    - `url`: The URL of the webpage.

### Error Handling

If an error occurs during the search process, the API will return an appropriate error message with an HTTP status code.

- **400**: If the request is malformed or missing required fields (e.g., no `sources` or `query`).
- **500**: If an internal server error occurs during the search.

---

## Internal Chat API

The `/api/chat` endpoint is the internal streaming API used by Perplexica's frontend. It uses a different request/response format from `/api/search` and is documented here for integration developers.

> **Note**: For most integrations, prefer `/api/search` above. The `/api/chat` endpoint is designed for Perplexica's UI and may change between versions.

### **POST** `/api/chat`

**Full URL**: `http://localhost:3000/api/chat`

#### Request Body Structure

```json
{
  "message": {
    "messageId": "msg-123",
    "chatId": "chat-456",
    "content": "What is Perplexica?"
  },
  "chatModel": {
    "providerId": "550e8400-e29b-41d4-a716-446655440000",
    "key": "gpt-4o-mini"
  },
  "embeddingModel": {
    "providerId": "550e8400-e29b-41d4-a716-446655440000",
    "key": "text-embedding-3-large"
  },
  "sources": ["web"],
  "optimizationMode": "balanced",
  "history": [
    ["human", "Hi"],
    ["assistant", "Hello! How can I help?"]
  ],
  "files": [],
  "systemInstructions": ""
}
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | object | ✅ | `{ messageId, chatId, content }` — message identifiers and query text |
| `chatModel` | object | ✅ | `{ providerId, key }` — chat model to use (from `/api/providers`) |
| `embeddingModel` | object | ✅ | `{ providerId, key }` — embedding model (from `/api/providers`) |
| `sources` | string[] | No | Sources to search: `"web"`, `"academic"`, `"discussions"`. Default: `[]` |
| `optimizationMode` | string | ✅ | `"speed"`, `"balanced"`, or `"quality"` |
| `history` | array | No | Previous conversation as `["human"/"assistant", "text"]` tuples |
| `files` | string[] | No | Uploaded file IDs to include in search context |
| `systemInstructions` | string \| null | No | Custom instructions for the AI (may be null or omitted) |

#### Response Format

The response is an NDJSON (newline-delimited JSON) stream with `Content-Type: text/event-stream`. Each line is a complete JSON object.

Event types:

| Type | Description | Fields |
|------|-------------|--------|
| `block` | New content block created | `block` (full block object, e.g. `{ id, type, data, ... }`) |
| `updateBlock` | Incremental update to a block | `blockId, patch` (JSON Patch array) |
| `researchComplete` | Search/research phase finished | — |
| `messageEnd` | Stream complete | — |
| `error` | Error occurred | `data` (error message) |

The `updateBlock` events use [JSON Patch](https://jsonpatch.com/) format. To get the final answer text, look for `patch` entries with `op: "replace"` and `path: "/data"` — the `value` field contains the cumulative text for that block.
