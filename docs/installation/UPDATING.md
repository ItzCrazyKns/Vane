# Update Perplexica to the latest version

To update Perplexica to the latest version, follow these steps:

## For Docker users (Using pre-built images)

Simply pull the latest image and restart your container:

```bash
docker pull itzcrazykns1337/perplexica:latest
docker stop perplexica
docker rm perplexica
docker run -d -p 3000:3000 -v perplexica-data:/home/perplexica/data -v perplexica-uploads:/home/perplexica/uploads --name perplexica itzcrazykns1337/perplexica:latest
```

For slim version:

```bash
docker pull itzcrazykns1337/perplexica:slim-latest
docker stop perplexica
docker rm perplexica
docker run -d -p 3000:3000 -e SEARXNG_API_URL=http://your-searxng-url:8080 -v perplexica-data:/home/perplexica/data -v perplexica-uploads:/home/perplexica/uploads --name perplexica itzcrazykns1337/perplexica:slim-latest
```

Once updated, go to http://localhost:3000 and verify the latest changes. Your settings are preserved automatically.

## For Docker users (Building from source)

1. Navigate to your Perplexica directory and pull the latest changes:

   ```bash
   cd Perplexica
   git pull origin master
   ```

2. Rebuild the Docker image:

   ```bash
   docker build -t perplexica .
   ```

3. Stop and remove the old container, then start the new one:

   ```bash
   docker stop perplexica
   docker rm perplexica
   docker run -p 3000:3000 -p 8080:8080 --name perplexica perplexica
   ```

4. Once the command completes, go to http://localhost:3000 and verify the latest changes.

## For non-Docker users

1. Navigate to your Perplexica directory and pull the latest changes:

   ```bash
   cd Perplexica
   git pull origin master
   ```

2. Install any new dependencies:

   ```bash
   npm i
   ```

3. Rebuild the application:

   ```bash
   npm run build
   ```

4. Restart the application:

   ```bash
   npm run start
   ```

5. Go to http://localhost:3000 and verify the latest changes. Your settings are preserved automatically.

---
