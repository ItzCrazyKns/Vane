## How does Perplexica work?

Curious about how Perplexica works? Don't worry, we'll cover it here. Before we begin, make sure you've read about the architecture of Perplexica to ensure you understand what it's made up of. Haven't read it? You can read it [here](https://github.com/ItzCrazyKns/Perplexica/tree/master/docs/architecture/README.md).

We'll understand how Perplexica works by taking an example of a scenario where a user asks: "How does an A.C. work?". We'll break down the process into steps to make it easier to understand. The steps are as follows:

1. The message is sent via WS to the backend server where it invokes the chain. The chain will depend on your focus mode. For this example, let's assume we use the "webSearch" focus mode.
2. The chain is now invoked; first, the message is passed to another chain where it first predicts (using the chat history and the question) whether there is a need for sources and searching the web. If there is, it will generate a query (in accordance with the chat history) for searching the web that we'll take up later. If not, the chain will end there, and then the answer generator chain, also known as the response generator, will be started.
3. The query returned by the first chain is passed to SearXNG to search the web for information.
4. After the information is retrieved, it is based on keyword-based search. We then convert the information into embeddings and the query as well, then we perform a similarity search to find the most relevant sources to answer the query.
5. After all this is done, the sources are passed to the response generator. This chain takes all the chat history, the query, and the sources. It generates a response that is streamed to the UI.

### How are the answers cited?

The LLMs are prompted to do so. We've prompted them so well that they cite the answers themselves, and using some UI magic, we display it to the user.

### Image and Video Search

Image and video searches are conducted in a similar manner. A query is always generated first, then we search the web for images and videos that match the query. These results are then returned to the user.
