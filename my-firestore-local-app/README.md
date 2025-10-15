# My Local App (Postgres + Prisma)

This project runs locally using Postgres and Prisma. The server provides REST endpoints and stores data in a local Postgres database for development and testing.

## Project Structure

```
my-firestore-local-app
├── src
│   ├── server.ts              # Entry point of the application
│   ├── app.ts                 # Express application configuration
│   ├── controllers            # Contains route controllers
│   │   └── index.ts           # Main controller for handling routes
│   ├── routes                 # Application routes
│   │   └── index.ts           # Route definitions
│   ├── services               # Service layer for business logic
│   │   └── sqlClient.ts       # Prisma SQL client for database operations
│   ├── models                 # Data models
│   │   └── index.ts           # Main model definitions
│   └── types                  # Type definitions for TypeScript
│       └── index.ts           # Main type definitions
├── scripts
│   └── start-local.sh         # Script to start the local server and run migrations
├── .env.example               # Example environment variables
├── .env.example               # Example environment variables
├── package.json               # NPM configuration and dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd my-firestore-local-app
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Configure environment variables:**
   - Copy `.env.example` to `.env` and fill in the required values.

4. **Start the Firestore emulator and local server:**
   ```
   ./scripts/start-local.sh
   ```

## Usage

- The application will run on `http://localhost:3000` (or the port specified in your configuration).
- You can interact with the Firestore emulator through the defined routes.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes. 

## License

This project is licensed under the MIT License.