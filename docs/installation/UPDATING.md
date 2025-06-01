# Update Perplexica to the latest version

To update Perplexica to the latest version, follow these steps:

## For Docker users

1. Clone the latest version of Perplexica from GitHub:

   ```bash
   git clone https://github.com/ItzCrazyKns/Perplexica.git
   ```

2. Navigate to the project directory.

3. Check for changes in the configuration files. If the `sample.config.toml` file contains new fields, delete your existing `config.toml` file, rename `sample.config.toml` to `config.toml`, and update the configuration accordingly.

4. Pull the latest images from the registry.

   ```bash
   docker compose pull
   ```

5. Update and recreate the containers.

   ```bash
   docker compose up -d
   ```

6. Once the command completes, go to http://localhost:3000 and verify the latest changes.

## For non-Docker users

1. Clone the latest version of Perplexica from GitHub:

   ```bash
   git clone https://github.com/ItzCrazyKns/Perplexica.git
   ```

2. Navigate to the project directory.

3. Check for changes in the configuration files. If the `sample.config.toml` file contains new fields, delete your existing `config.toml` file, rename `sample.config.toml` to `config.toml`, and update the configuration accordingly.
4. After populating the configuration run `npm i`.
5. Install the dependencies and then execute `npm run build`.
6. Finally, start the app by running `npm run start`

---
