# Blockchain Indexer

A production-ready UTXO-based blockchain indexer built with TypeScript, Fastify, and PostgreSQL. This indexer tracks address balances and supports blockchain rollbacks.

## Features

- **UTXO Model Implementation** - Tracks unspent transaction outputs
- **Balance Tracking** - Real-time balance calculation for all addresses
- **Block Validation** - Comprehensive validation including height, hash, and transaction integrity
- **Rollback Support** - Revert blockchain state to any previous height
- **Clean Architecture** - Separation of concerns with repositories, services, and routes
- **Type Safety** - Full TypeScript implementation
- **Comprehensive Tests** - Extensive test coverage for all operations
- **Docker Support** - Easy deployment with Docker Compose

## Architecture

```
src/
├── interfaces/
│   └── index.ts                 # TypeScript interfaces and types
├── database/
│   ├── connection.ts            # Database connection pool management
│   ├── schema.ts                # Database schema definitions
│   └── repositories/
│       ├── blockRepository.ts   # Block data access layer
│       ├── outputRepository.ts  # Output (UTXO) data access layer
│       └── balanceRepository.ts # Balance data access layer
├── services/
│   └── blockService.ts          # Business logic and validations
├── utils/
│   └── crypto.ts                # Cryptographic utilities (SHA-256)
├── routes/
│   └── index.ts                 # API route definitions
└── server.ts                    # Application entry point
```

### Design Principles

1. **Repository Pattern**: Database operations are encapsulated in repository classes
2. **Service Layer**: Business logic is separated from route handlers
3. **Type Safety**: Comprehensive TypeScript interfaces for all data structures
4. **Transaction Management**: PostgreSQL transactions ensure data consistency
5. **Error Handling**: Proper validation and error responses

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 12+ (or use Docker)
- npm or yarn

### Local Development

#### Quick Setup (Recommended)

```bash
# Clone and run setup script
git clone <repository-url>
cd blockchain-indexer
chmod +x setup.sh
./setup.sh
```

The setup script will:
- Check Node.js version
- Install dependencies
- Create .env file
- Let you choose Docker or local setup
- Start the services

#### Manual Setup with Local PostgreSQL

1. **Clone the repository**
```bash
git clone <repository-url>
cd blockchain-indexer
```

2. **Install dependencies**
```bash
npm install
npm install dotenv
```

3. **Install and configure PostgreSQL**
```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

4. **Configure PostgreSQL authentication**

Edit the pg_hba.conf file:
```bash
# Find your PostgreSQL version
ls /etc/postgresql/

# Edit configuration (replace XX with your version, e.g., 12)
sudo nano /etc/postgresql/XX/main/pg_hba.conf
```

Change authentication methods to `trust` for local development:
```
# Database administrative login by Unix domain socket
local   all             postgres                                trust

# "local" is for Unix domain socket connections only
local   all             all                                     trust
# IPv4 local connections:
host    all             all             127.0.0.1/32            trust
# IPv6 local connections:
host    all             all             ::1/128                 trust
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

5. **Create database**
```bash
sudo -u postgres psql -c "CREATE DATABASE blockchain_indexer;"
```

6. **Find your PostgreSQL port**
```bash
sudo -u postgres psql
# Inside psql:
\conninfo
# Note the port number, then exit:
\q
```

7. **Set up environment variables**

Create `.env` file:
```bash
# If using default port 5432
DATABASE_URL=postgresql://postgres@/blockchain_indexer?host=/var/run/postgresql

# If using different port (e.g., 5433)
DATABASE_URL=postgresql://postgres@/blockchain_indexer?host=/var/run/postgresql&port=5433

# Application Configuration
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
```

8. **Update server.ts to load environment variables**

Add this import at the very top of `src/server.ts`:
```typescript
import 'dotenv/config';
```

9. **Run in development mode**
```bash
npm run dev
```

### Using Docker Compose

The easiest way to run the entire stack:

```bash
# Start both API and PostgreSQL
docker-compose up -d
# Or: make docker-up

# View logs
docker-compose logs -f api
# Or: make docker-logs

# Stop services
docker-compose down
# Or: make docker-down

# Stop and remove volumes (clears database)
docker-compose down -v
# Or: make docker-clean
```

### Using Makefile

For convenience, common commands are available via Makefile:

```bash
make help           # Show all available commands
make install        # Install dependencies
make dev            # Run development server
make test           # Run tests
make test-coverage  # Run tests with coverage
make lint           # Lint code
make format         # Format code
make docker-up      # Start Docker services
make docker-down    # Stop Docker services
make db-shell       # Connect to PostgreSQL
```

## API Reference

### POST /blocks

Add a new block to the blockchain.

**Request Body:**
```json
{
  "id": "block_hash",
  "height": 1,
  "transactions": [
    {
      "id": "tx1",
      "inputs": [
        {
          "txId": "previous_tx_id",
          "index": 0
        }
      ],
      "outputs": [
        {
          "address": "addr1",
          "value": 100
        }
      ]
    }
  ]
}
```

**Validations:**
- Height must be exactly one unit higher than current height
- Block ID must be `sha256(height + tx1.id + tx2.id + ... + txN.id)`
- Sum of input values must equal sum of output values (except for coinbase transactions with no inputs)
- Inputs must reference unspent outputs

**Response:**
```json
{
  "success": true
}
```

**Error Response (400):**
```json
{
  "error": "Invalid height. Expected 5, got 3"
}
```

### GET /balance/:address

Get the current balance for an address.

**Response:**
```json
{
  "address": "addr1",
  "balance": 100
}
```

### POST /rollback?height=number

Rollback the blockchain to a specific height.

**Query Parameters:**
- `height` (required): Target height to rollback to

**Response:**
```json
{
  "success": true,
  "height": 5
}
```

**Error Response (400):**
```json
{
  "error": "Target height is greater than current height"
}
```

## Calculating Block Hashes

The block ID must be the SHA-256 hash of the concatenation of the block height and all transaction IDs.

**Formula:** `sha256(height + tx1.id + tx2.id + ... + txN.id)`

### Using Command Line

```bash
# For block 1 with transaction "tx1"
echo -n "1tx1" | sha256sum
# Output: d1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc

# For block 2 with transaction "tx2"
echo -n "2tx2" | sha256sum

# For block 3 with multiple transactions
echo -n "3tx3tx4tx5" | sha256sum
```

### Helper Script

Create `hash.sh`:
```bash
#!/bin/bash
echo -n "$1" | sha256sum | awk '{print $1}'
```

Make it executable and use:
```bash
chmod +x hash.sh
./hash.sh "1tx1"
./hash.sh "2tx2"
```

### Using Node.js

Create `calculate_hash.js`:
```javascript
import crypto from 'crypto';

const height = process.argv[2];
const txIds = process.argv.slice(3);
const data = `${height}${txIds.join('')}`;
const hash = crypto.createHash('sha256').update(data).digest('hex');

console.log(hash);
```

Use it:
```bash
node calculate_hash.js 1 tx1
node calculate_hash.js 2 tx2
node calculate_hash.js 3 tx3 tx4
```

## Example Usage

### Creating a Blockchain

**Block 1: Create initial output**
```bash
# Calculate hash
echo -n "1tx1" | sha256sum
# Result: d1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc

curl -X POST http://localhost:3000/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "d1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc",
    "height": 1,
    "transactions": [{
      "id": "tx1",
      "inputs": [],
      "outputs": [{
        "address": "alice",
        "value": 100
      }]
    }]
  }'
```

**Check Alice's balance**
```bash
curl http://localhost:3000/balance/alice
# Returns: {"address":"alice","balance":100}
```

**Block 2: Alice sends 60 to Bob, 40 to Charlie**
```bash
# Calculate hash
echo -n "2tx2" | sha256sum
# Result: 5fa457accfc342e701f7dfe71c45c6347790f4c75e4cd8ca37e9fccd23e47aa5

curl -X POST http://localhost:3000/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "5fa457accfc342e701f7dfe71c45c6347790f4c75e4cd8ca37e9fccd23e47aa5",
    "height": 2,
    "transactions": [{
      "id": "tx2",
      "inputs": [{
        "txId": "tx1",
        "index": 0
      }],
      "outputs": [
        {"address": "bob", "value": 60},
        {"address": "charlie", "value": 40}
      ]
    }]
  }'
```

**Check balances**
```bash
curl http://localhost:3000/balance/alice
# Returns: {"address":"alice","balance":0}

curl http://localhost:3000/balance/bob
# Returns: {"address":"bob","balance":60}

curl http://localhost:3000/balance/charlie
# Returns: {"address":"charlie","balance":40}
```

**Rollback to block 1**
```bash
curl -X POST "http://localhost:3000/rollback?height=1"
# Returns: {"success":true,"height":1}
```

**Verify rollback worked**
```bash
curl http://localhost:3000/balance/alice
# Returns: {"address":"alice","balance":100}

curl http://localhost:3000/balance/bob
# Returns: {"address":"bob","balance":0}
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Test Coverage

```bash
npm run test:coverage
```

### Test Framework

This project uses **Vitest** - a blazing fast unit test framework powered by Vite. It provides:
- Native ESM support
- Fast execution with smart watch mode
- Compatible API with Jest
- Great TypeScript support

### Test Categories

The test suite includes:

1. **Basic Functionality Tests**
   - Block acceptance
   - Sequential block processing
   - Multiple transactions per block

2. **Validation Tests**
   - Invalid height rejection
   - Block ID verification
   - Input/output sum validation
   - Double-spending prevention

3. **Balance Tests**
   - Balance tracking
   - Multiple transactions
   - Change addresses
   - Multiple outputs to same address

4. **Rollback Tests**
   - Rollback to specific height
   - Balance restoration
   - Re-adding blocks after rollback
   - Edge cases (height 0, invalid heights)

5. **Edge Cases**
   - Multiple inputs
   - Empty transaction lists
   - Long transaction chains
   - Complex spending patterns

## Database Schema

### Blocks Table
```sql
CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  height INTEGER UNIQUE NOT NULL
);
```

### Outputs Table
```sql
CREATE TABLE outputs (
  tx_id TEXT NOT NULL,
  output_index INTEGER NOT NULL,
  address TEXT NOT NULL,
  value NUMERIC NOT NULL,
  block_height INTEGER NOT NULL,
  spent BOOLEAN DEFAULT false,
  PRIMARY KEY (tx_id, output_index),
  FOREIGN KEY (block_height) REFERENCES blocks(height) ON DELETE CASCADE
);
```

### Balances Table
```sql
CREATE TABLE balances (
  address TEXT PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 0
);
```

### Indexes
- `idx_outputs_block_height` - For efficient rollback queries
- `idx_outputs_spent` - For finding unspent outputs
- `idx_outputs_address` - For address-based queries

## Development

### Build

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## UTXO Model Explanation

The **Unspent Transaction Output (UTXO)** model is used by Bitcoin and similar blockchains:

1. **Transactions have inputs and outputs**
   - Outputs: Create new UTXOs that assign value to addresses
   - Inputs: Reference and spend previous outputs

2. **Balance Calculation**
   - An address's balance = sum of unspent outputs - sum of spent outputs
   - When an output is used as input, it's marked as "spent"

3. **Transaction Validation**
   - Inputs must reference existing, unspent outputs
   - Sum of input values must equal sum of output values
   - This prevents double-spending and ensures conservation of value

4. **Example Flow**
   ```
   Block 1: [] -> [Alice: 100]
   Alice's balance: 100
   
   Block 2: [Alice: 100] -> [Bob: 60, Charlie: 40]
   Alice's balance: 0 (spent 100)
   Bob's balance: 60
   Charlie's balance: 40
   
   Block 3: [Bob: 60] -> [Dave: 30, Bob: 30]
   Bob's balance: 30 (spent 60, received 30 change)
   Dave's balance: 30
   ```

## Troubleshooting

### PostgreSQL Authentication Issues

If you see "password authentication failed" or "peer authentication failed":

1. Edit pg_hba.conf:
```bash
sudo nano /etc/postgresql/12/main/pg_hba.conf
```

2. Change all `peer` and `md5` to `trust`:
```
local   all             postgres                                trust
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
```

3. Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Wrong PostgreSQL Port

If PostgreSQL is running on a non-standard port:

1. Find your port:
```bash
sudo -u postgres psql
\conninfo
\q
```

2. Update .env with correct port:
```bash
DATABASE_URL=postgresql://postgres@/blockchain_indexer?host=/var/run/postgresql&port=YOUR_PORT
```

### Connection String Issues

If you see "SASL" or password parsing errors, use Unix socket connection:

```bash
DATABASE_URL=postgresql:///blockchain_indexer?host=/var/run/postgresql&port=5433
```

### Node.js Version Too Old

If you see version errors:

```bash
# Using NVM (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

### Missing dotenv

If environment variables aren't loading:

```bash
npm install dotenv
```

Add to top of `src/server.ts`:
```typescript
import 'dotenv/config';
```

## Performance Considerations

1. **Database Indexes**: Optimized for common queries (balance lookups, UTXO searches)
2. **Connection Pooling**: Efficient database connection management
3. **Transaction Batching**: All block operations in single database transaction
4. **Rollback Limit**: Designed for rollbacks up to 2000 blocks

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Validation error (invalid block, double-spend, etc.)
- `500` - Internal server error

All error responses include a descriptive error message:
```json
{
  "error": "Descriptive error message here"
}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql:///blockchain_indexer?host=/var/run/postgresql&port=5433` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | API server port | `3000` |
| `API_URL` | API URL for tests | `http://localhost:3000` |

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Ensure all tests pass before submitting
4. Use TypeScript strict mode
5. Follow the repository pattern for database access

## License

MIT

## Support

For issues or questions, please open an issue on the repository.

```
src/
├── types/
│   └── index.ts                 # TypeScript interfaces and types
├── database/
│   ├── connection.ts            # Database connection pool management
│   ├── schema.ts                # Database schema definitions
│   └── repositories/
│       ├── blockRepository.ts   # Block data access layer
│       ├── outputRepository.ts  # Output (UTXO) data access layer
│       └── balanceRepository.ts # Balance data access layer
├── services/
│   └── blockService.ts          # Business logic and validations
├── utils/
│   └── crypto.ts                # Cryptographic utilities (SHA-256)
├── routes/
│   └── index.ts                 # API route definitions
└── server.ts                    # Application entry point
```

### Design Principles

1. **Repository Pattern**: Database operations are encapsulated in repository classes
2. **Service Layer**: Business logic is separated from route handlers
3. **Type Safety**: Comprehensive TypeScript interfaces for all data structures
4. **Transaction Management**: PostgreSQL transactions ensure data consistency
5. **Error Handling**: Proper validation and error responses

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use Docker)
- npm or yarn

### Local Development

#### Quick Setup (Recommended)

```bash
# Clone and run setup script
git clone <repository-url>
cd blockchain-indexer
chmod +x setup.sh
./setup.sh
```

The setup script will:
- ✅ Check Node.js version
- ✅ Install dependencies
- ✅ Create .env file
- ✅ Let you choose Docker or local setup
- ✅ Start the services

#### Manual Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd blockchain-indexer
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
# Create .env file
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blockchain_indexer" > .env
```

4. **Start PostgreSQL** (if not using Docker)
```bash
# Using Docker for PostgreSQL only
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=blockchain_indexer \
  -p 5432:5432 \
  postgres:16-alpine
```

5. **Run in development mode**
```bash
npm run dev
```

### Using Docker Compose

The easiest way to run the entire stack:

```bash
# Start both API and PostgreSQL
docker-compose up -d
# Or use: make docker-up

# View logs
docker-compose logs -f api
# Or use: make docker-logs

# Stop services
docker-compose down
# Or use: make docker-down

# Stop and remove volumes (clears database)
docker-compose down -v
# Or use: make docker-clean
```

### Using Makefile

For convenience, common commands are available via Makefile:

```bash
make help           # Show all available commands
make install        # Install dependencies
make dev            # Run development server
make test           # Run tests
make test-coverage  # Run tests with coverage
make lint           # Lint code
make format         # Format code
make docker-up      # Start Docker services
make docker-down    # Stop Docker services
make db-shell       # Connect to PostgreSQL
```

## API Reference

### POST /blocks

Add a new block to the blockchain.

**Request Body:**
```json
{
  "id": "block_hash",
  "height": 1,
  "transactions": [
    {
      "id": "tx1",
      "inputs": [
        {
          "txId": "previous_tx_id",
          "index": 0
        }
      ],
      "outputs": [
        {
          "address": "addr1",
          "value": 100
        }
      ]
    }
  ]
}
```

**Validations:**
- Height must be exactly one unit higher than current height
- Block ID must be `sha256(height + tx1.id + tx2.id + ... + txN.id)`
- Sum of input values must equal sum of output values (except for coinbase transactions with no inputs)
- Inputs must reference unspent outputs

**Response:**
```json
{
  "success": true
}
```

**Error Response (400):**
```json
{
  "error": "Invalid height. Expected 5, got 3"
}
```

### GET /balance/:address

Get the current balance for an address.

**Response:**
```json
{
  "address": "addr1",
  "balance": 100
}
```

### POST /rollback?height=number

Rollback the blockchain to a specific height.

**Query Parameters:**
- `height` (required): Target height to rollback to

**Response:**
```json
{
  "success": true,
  "height": 5
}
```

**Error Response (400):**
```json
{
  "error": "Target height is greater than current height"
}
```

## Example Usage

### Creating a Blockchain

```bash
# Block 1: Create initial output
curl -X POST http://localhost:3000/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "calculated_hash_here",
    "height": 1,
    "transactions": [{
      "id": "tx1",
      "inputs": [],
      "outputs": [{
        "address": "alice",
        "value": 100
      }]
    }]
  }'

# Check Alice's balance
curl http://localhost:3000/balance/alice
# Returns: {"address":"alice","balance":100}

# Block 2: Alice sends 60 to Bob, 40 to Charlie
curl -X POST http://localhost:3000/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "calculated_hash_here",
    "height": 2,
    "transactions": [{
      "id": "tx2",
      "inputs": [{
        "txId": "tx1",
        "index": 0
      }],
      "outputs": [
        {"address": "bob", "value": 60},
        {"address": "charlie", "value": 40}
      ]
    }]
  }'

# Check balances
curl http://localhost:3000/balance/alice
# Returns: {"address":"alice","balance":0}

curl http://localhost:3000/balance/bob
# Returns: {"address":"bob","balance":60}

# Rollback to block 1
curl -X POST "http://localhost:3000/rollback?height=1"

# Check Alice's balance again
curl http://localhost:3000/balance/alice
# Returns: {"address":"alice","balance":100}
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Test Coverage

```bash
npm run test:coverage
```

### Test Framework

This project uses **Vitest** - a blazing fast unit test framework powered by Vite. It provides:
- Native ESM support
- Fast execution with smart watch mode
- Compatible API with Jest
- Great TypeScript support

### Test Categories

The test suite includes:

1. **Basic Functionality Tests**
   - Block acceptance
   - Sequential block processing
   - Multiple transactions per block

2. **Validation Tests**
   - Invalid height rejection
   - Block ID verification
   - Input/output sum validation
   - Double-spending prevention

3. **Balance Tests**
   - Balance tracking
   - Multiple transactions
   - Change addresses
   - Multiple outputs to same address

4. **Rollback Tests**
   - Rollback to specific height
   - Balance restoration
   - Re-adding blocks after rollback
   - Edge cases (height 0, invalid heights)

5. **Edge Cases**
   - Multiple inputs
   - Empty transaction lists
   - Long transaction chains
   - Complex spending patterns

## Database Schema

### Blocks Table
```sql
CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  height INTEGER UNIQUE NOT NULL
);
```

### Outputs Table
```sql
CREATE TABLE outputs (
  tx_id TEXT NOT NULL,
  output_index INTEGER NOT NULL,
  address TEXT NOT NULL,
  value NUMERIC NOT NULL,
  block_height INTEGER NOT NULL,
  spent BOOLEAN DEFAULT false,
  PRIMARY KEY (tx_id, output_index),
  FOREIGN KEY (block_height) REFERENCES blocks(height) ON DELETE CASCADE
);
```

### Balances Table
```sql
CREATE TABLE balances (
  address TEXT PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 0
);
```

### Indexes
- `idx_outputs_block_height` - For efficient rollback queries
- `idx_outputs_spent` - For finding unspent outputs
- `idx_outputs_address` - For address-based queries

## Development

### Build

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## UTXO Model Explanation

The **Unspent Transaction Output (UTXO)** model is used by Bitcoin and similar blockchains:

1. **Transactions have inputs and outputs**
   - Outputs: Create new UTXOs that assign value to addresses
   - Inputs: Reference and spend previous outputs

2. **Balance Calculation**
   - An address's balance = sum of unspent outputs - sum of spent outputs
   - When an output is used as input, it's marked as "spent"

3. **Transaction Validation**
   - Inputs must reference existing, unspent outputs
   - Sum of input values must equal sum of output values
   - This prevents double-spending and ensures conservation of value

4. **Example Flow**
   ```
   Block 1: [] -> [Alice: 100]
   Alice's balance: 100
   
   Block 2: [Alice: 100] -> [Bob: 60, Charlie: 40]
   Alice's balance: 0 (spent 100)
   Bob's balance: 60
   Charlie's balance: 40
   
   Block 3: [Bob: 60] -> [Dave: 30, Bob: 30]
   Bob's balance: 30 (spent 60, received 30 change)
   Dave's balance: 30
   ```

## Performance Considerations

1. **Database Indexes**: Optimized for common queries (balance lookups, UTXO searches)
2. **Connection Pooling**: Efficient database connection management
3. **Transaction Batching**: All block operations in single database transaction
4. **Rollback Limit**: Designed for rollbacks up to 2000 blocks

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Validation error (invalid block, double-spend, etc.)
- `500` - Internal server error

All error responses include a descriptive error message:
```json
{
  "error": "Descriptive error message here"
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `NODE_ENV` | Environment (development/production) | development |

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Ensure all tests pass before submitting
4. Use TypeScript strict mode
5. Follow the repository pattern for database access

## License

MIT

## Support

For issues or questions, please open an issue on the repository.