# How to Contribute to Perplexica

Hey there, thanks for deciding to contribute to Perplexica. Anything you help with will support the development of Perplexica and will make it better. Let's walk you through the key aspects to ensure your contributions are effective and in harmony with the project's setup.

## Project Structure

Perplexica's design consists of two main domains:

- **Frontend (`ui` directory)**: This is a Next.js application holding all user interface components. It's a self-contained environment that manages everything the user interacts with.
- **Backend (root and `src` directory)**: The backend logic is situated in the `src` folder, but the root directory holds the main `package.json` for backend dependency management.

## Setting Up Your Environment

Before diving into coding, setting up your local environment is key. Here's what you need to do:

### Backend

1. In the root directory, locate the `sample.config.toml` file.
2. Rename it to `config.toml` and fill in the necessary configuration fields specific to the backend.
3. Run `npm install` to install dependencies.
4. Use `npm run dev` to start the backend in development mode.

### Frontend

1. Navigate to the `ui` folder and repeat the process of renaming `.env.example` to `.env`, making sure to provide the frontend-specific variables.
2. Execute `npm install` within the `ui` directory to get the frontend dependencies ready.
3. Launch the frontend development server with `npm run dev`.

**Please note**: Docker configurations are present for setting up production environments, whereas `npm run dev` is used for development purposes.

## Coding and Contribution Practices

Before committing changes:

1. Ensure that your code functions correctly by thorough testing.
2. Always run `npm run format:write` to format your code according to the project's coding standards. This helps maintain consistency and code quality.
3. We currently do not have a code of conduct, but it is in the works. In the meantime, please be mindful of how you engage with the project and its community.

Following these steps will help maintain the integrity of Perplexica's codebase and facilitate a smoother integration of your valuable contributions. Thank you for your support and commitment to improving Perplexica.
