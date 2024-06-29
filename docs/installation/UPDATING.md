# Update Perplexica to the latest version

To update Perplexica to the latest version, follow these steps:

## For Docker users

1. Clone the latest version of Perplexica from GitHub:

```bash
   git clone https://github.com/ItzCrazyKns/Perplexica.git
```

2. Navigate to the Project Directory

3. Update and Rebuild Docker Containers:

```bash
docker compose up -d --build
```
4. Once the command completes running go to http://localhost:3000 and verify the latest changes.

## For non Docker users

1. Clone the latest version of Perplexica from GitHub:

```bash
   git clone https://github.com/ItzCrazyKns/Perplexica.git
```

2. Navigate to the Project Directory
3. Execute `npm i` in both the `ui` folder and the root directory.
4. Once packages are updated, execute `npm run build` in both the `ui` folder and the root directory.
5. Finally, start both the frontend and the backend by running `npm run start` in both the `ui` folder and the root directory.
