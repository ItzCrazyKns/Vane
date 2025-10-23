# Perplexica Search API Documentation

## Overview

Perplexica’s Search API makes it easy to use our AI-powered search engine. You can run different types of searches, pick the models you want to use, and get the most recent info. Follow the following headings to learn more about Perplexica's search API.

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

**Note**: Replace `localhost:3000` with your Perplexica instance URL if running on a different host or port

### Request

The API accepts a JSON object in the request body, where you define the focus mode, chat models, embedding models, and your query.

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
  "focusMode": "webSearch",
  "query": "What is Perplexica",
  "history": [
    ["human", "Hi, how are you?"],
    ["assistant", "I am doing well, how can I help you today?"]
  ],
  "systemInstructions": "Focus on providing technical details about Perplexica's architecture.",
  "stream": false
}
```

**Note**: The `providerId` must be a valid UUID obtained from the `/api/providers` endpoint. The example above uses a sample UUID for demonstration.

### Request Parameters

- **`chatModel`** (object, optional): Defines the chat model to be used for the query. To get available providers and models, send a GET request to `http://localhost:3000/api/providers`.

  - `providerId` (string): The UUID of the provider. You can get this from the `/api/providers` endpoint response.
  - `key` (string): The model key/identifier (e.g., `gpt-4o-mini`, `llama3.1:latest`). Use the `key` value from the provider's `chatModels` array, not the display name.

- **`embeddingModel`** (object, optional): Defines the embedding model for similarity-based searching. To get available providers and models, send a GET request to `http://localhost:3000/api/providers`.

  - `providerId` (string): The UUID of the embedding provider. You can get this from the `/api/providers` endpoint response.
  - `key` (string): The embedding model key (e.g., `text-embedding-3-large`, `nomic-embed-text`). Use the `key` value from the provider's `embeddingModels` array, not the display name.

- **`focusMode`** (string, required): Specifies which focus mode to use. Available modes:

  - `webSearch`, `academicSearch`, `writingAssistant`, `wolframAlphaSearch`, `youtubeSearch`, `redditSearch`.

- **`optimizationMode`** (string, optional): Specifies the optimization mode to control the balance between performance and quality. Available modes:

  - `speed`: Prioritize speed and return the fastest answer.
  - `balanced`: Provide a balanced answer with good speed and reasonable quality.

- **`query`** (string, required): The search query or question.

- **`systemInstructions`** (string, optional): Custom instructions provided by the user to guide the AI's response. These instructions are treated as user preferences and have lower priority than the system's core instructions. For example, you can specify a particular writing style, format, or focus area.

- **`history`** (array, optional): An array of message pairs representing the conversation history. Each pair consists of a role (either 'human' or 'assistant') and the message content. This allows the system to use the context of the conversation to refine results. Example:

  ```json
  [
    ["human", "What is Perplexica?"],
    ["assistant", "Perplexica is an AI-powered search engine..."]
  ]
  ```

- **`stream`** (boolean, optional): When set to `true`, enables streaming responses. Default is `false`.

### Response

The response from the API includes both the final message and the sources used to generate that message.

#### Standard Response (stream: false)

```json
{
  "message": "Perplexica is an innovative, open-source AI-powered search engine designed to enhance the way users search for information online. Here are some key features and characteristics of Perplexica:\n\n- **AI-Powered Technology**: It utilizes advanced machine learning algorithms to not only retrieve information but also to understand the context and intent behind user queries, providing more relevant results [1][5].\n\n- **Open-Source**: Being open-source, Perplexica offers flexibility and transparency, allowing users to explore its functionalities without the constraints of proprietary software [3][10].",
  "sources": [
    {
      "pageContent": "Perplexica is an innovative, open-source AI-powered search engine designed to enhance the way users search for information online.",
      "metadata": {
        "title": "What is Perplexica, and how does it function as an AI-powered search ...",
        "url": "https://askai.glarity.app/search/What-is-Perplexica--and-how-does-it-function-as-an-AI-powered-search-engine"
      }
    },
    {
      "pageContent": "Perplexica is an open-source AI-powered search tool that dives deep into the internet to find precise answers.",
      "metadata": {
        "title": "Sahar Mor's Post",
        "url": "https://www.linkedin.com/posts/sahar-mor_a-new-open-source-project-called-perplexica-activity-7204489745668694016-ncja"
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
{"type":"sources","data":[{"pageContent":"...","metadata":{"title":"...","url":"..."}},...]}
{"type":"response","data":"Perplexica is an "}
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

- **`message`** (string): The search result, generated based on the query and focus mode.
- **`sources`** (array): A list of sources that were used to generate the search result. Each source includes:
  - `pageContent`: A snippet of the relevant content from the source.
  - `metadata`: Metadata about the source, including:
    - `title`: The title of the webpage.
    - `url`: The URL of the webpage.

### Error Handling

If an error occurs during the search process, the API will return an appropriate error message with an HTTP status code.

- **400**: If the request is malformed or missing required fields (e.g., no focus mode or query).
- **500**: If an internal server error occurs during the search.
