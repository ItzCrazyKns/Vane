# Perplexica Configuration Guide

Perplexica can be configured using environment variables, which is especially useful for Docker deployments and automation. This guide explains the structure of these variables and provides examples for common providers.

## Environment Variable Structure

Perplexica uses a structured naming convention for environment variables to manage different sections of the configuration:

- **Search**: `SEARCH_<FIELD_NAME>` (e.g., `SEARCH_SEARXNG_URL`)
- **Preferences**: `PREFERENCES_<FIELD_NAME_IN_SNAKE_CASE>` (e.g., `PREFERENCES_THEME`, `PREFERENCES_AUTO_MEDIA_SEARCH`)
- **Personalization**: `PERSONALIZATION_<FIELD_NAME_IN_SNAKE_CASE>` (e.g., `PERSONALIZATION_SYSTEM_INSTRUCTIONS`)
- **Models**: `CHAT_PROVIDER_TYPE`, `CHAT_MODEL`, `EMBEDDING_PROVIDER_TYPE`, `EMBEDDING_MODEL`.

### Automatic Setup Completion
If you provide a complete set of the following variables, Perplexica will automatically skip the setup wizard on first start:
- `SEARCH_SEARXNG_URL`
- `CHAT_PROVIDER_TYPE`
- `CHAT_MODEL`
- `EMBEDDING_PROVIDER_TYPE`
- `EMBEDDING_MODEL`

## Provider Examples

### 1. Ollama (Local)
For running Perplexica entirely locally using Ollama.

```yaml
environment:
  - SEARCH_SEARXNG_URL=http://searxng:8080
  
  # Default Chat Model
  - CHAT_PROVIDER_TYPE=ollama
  - CHAT_PROVIDER_URL=http://host.docker.internal:11434
  - CHAT_MODEL=qwen2.5:7b
  
  # Default Embedding Model
  - EMBEDDING_PROVIDER_TYPE=ollama
  - EMBEDDING_PROVIDER_URL=http://host.docker.internal:11434
  - EMBEDDING_MODEL=nomic-embed-text:latest
  
  # Provider Specific
  - OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### 2. OpenAI (Cloud)
Using OpenAI for both chat and embeddings.

```yaml
environment:
  - SEARCH_SEARXNG_URL=http://searxng:8080
  
  # Default Models
  - CHAT_PROVIDER_TYPE=openai
  - CHAT_MODEL=gpt-4o
  - EMBEDDING_PROVIDER_TYPE=openai
  - EMBEDDING_MODEL=text-embedding-3-small
  
  # Provider Specific
  - OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Mixed (Anthropic + Transformers)
Using Anthropic for chat and local Transformers for embeddings.

```yaml
environment:
  - SEARCH_SEARXNG_URL=http://searxng:8080
  
  # Default Models
  - CHAT_PROVIDER_TYPE=anthropic
  - CHAT_MODEL=claude-3-5-sonnet-20240620
  - EMBEDDING_PROVIDER_TYPE=transformers
  - EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
  
  # Provider Specific
  - ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## OpenAI-Compatible Chat Completions API

Perplexica provides an OpenAI-compatible endpoint at `/api/openai/chat/completions`. This allows you to use Perplexica as a drop-in replacement for any application that supports OpenAI or Perplexity-style APIs.

### Endpoint Details
- **URL**: `http://your-perplexica-url:3000/api/openai/chat/completions`
- **Method**: `POST`
- **Auth**: Not required (currently)

### Features
- **Drop-in Compatibility**: Works with standard OpenAI client libraries.
- **Smart Model Routing**: You can request specific models, and Perplexica will route them to the correct configured provider.
- **Source Selection**: You can prefix your model name with a search source to focus the search (e.g., `academic/gpt-4o` or `news/claude-3`).
- **Citations**: Non-streaming responses include a `citations` field containing URLs of the sources used.

### Example Request (Python)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/api/openai",
    api_key="not-needed"
)

response = client.chat.completions.create(
    model="web/gpt-4o", # Focus search on the web
    messages=[
        {"role": "user", "content": "What are the latest developments in room-temperature superconductors?"}
    ],
    stream=False
)

print(response.choices[0].message.content)
print("Sources:", response.citations)
```

### Example Request (cURL)
```bash
curl http://localhost:3000/api/openai/chat/completions 
  -H "Content-Type: application/json" 
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "How does Perplexica work?"}],
    "stream": false
  }'
```
