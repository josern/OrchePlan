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

## Logging System

This application includes a comprehensive logging system with the following features:

- **Structured Logging**: JSON-formatted logs with contextual metadata
- **Multiple Log Levels**: Debug, Info, Warn, Error with environment-aware filtering
- **File Logging**: Automatic log file creation with rotation
- **Request Tracing**: Correlation IDs for tracking requests across services
- **Performance Monitoring**: Built-in execution time measurement

### Log Configuration

Configure logging through environment variables in `.env`:

```bash
LOG_LEVEL=info          # debug, info, warn, error
LOG_CONSOLE=true        # Enable/disable console output
LOG_FILE=true           # Enable/disable file logging
LOG_DIR=./logs          # Log directory path
```

### Log Files

Logs are automatically written to separate files by level:
- `logs/debug-YYYY-MM-DD.log`
- `logs/info-YYYY-MM-DD.log`
- `logs/warn-YYYY-MM-DD.log`
- `logs/error-YYYY-MM-DD.log`

See `docs/logging-system.md` for detailed documentation.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes. 

## License

This project is licensed under the MIT License.