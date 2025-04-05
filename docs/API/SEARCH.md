# Perplexica Search API Documentation

## Overview

Perplexica’s Search API makes it easy to use our AI-powered search engine. You can run different types of searches, pick the models you want to use, and get the most recent info. Follow the following headings to learn more about Perplexica's search API.

## Endpoint

### **POST** `http://localhost:3000/api/search`

**Note**: Replace `3000` with any other port if you've changed the default PORT

### Request

The API accepts a JSON object in the request body, where you define the focus mode, chat models, embedding models, and your query.

#### Request Body Structure

```json
{
  "chatModel": {
    "provider": "openai",
    "name": "gpt-4o-mini"
  },
  "embeddingModel": {
    "provider": "openai",
    "name": "text-embedding-3-large"
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

### Request Parameters

- **`chatModel`** (object, optional): Defines the chat model to be used for the query. For model details you can send a GET request at `http://localhost:3000/api/models`. Make sure to use the key value (For example "gpt-4o-mini" instead of the display name "GPT 4 omni mini").

  - `provider`: Specifies the provider for the chat model (e.g., `openai`, `ollama`).
  - `name`: The specific model from the chosen provider (e.g., `gpt-4o-mini`).
  - Optional fields for custom OpenAI configuration:
    - `customOpenAIBaseURL`: If you’re using a custom OpenAI instance, provide the base URL.
    - `customOpenAIKey`: The API key for a custom OpenAI instance.

- **`embeddingModel`** (object, optional): Defines the embedding model for similarity-based searching. For model details you can send a GET request at `http://localhost:3000/api/models`. Make sure to use the key value (For example "text-embedding-3-large" instead of the display name "Text Embedding 3 Large").

  - `provider`: The provider for the embedding model (e.g., `openai`).
  - `name`: The specific embedding model (e.g., `text-embedding-3-large`).

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

When streaming is enabled, the API returns a stream of newline-delimited JSON objects. Each line contains a complete, valid JSON object. The response has Content-Type: application/json.

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
