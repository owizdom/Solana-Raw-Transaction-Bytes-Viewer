# solana-raw-tx

A command-line tool to fetch and display raw transaction bytes for any Solana transaction signature. This tool fills the gap that major explorers like Solscan and Solana Explorer don't provide — direct access to raw transaction bytes.

## Features

- Fetch raw transaction bytes in base64 and hexadecimal formats
- Display human-readable transaction details (slot, block time, status, fee, signers)
- Parse and display transaction instructions
- Support for mainnet, devnet, and testnet
- Save raw bytes to binary files
- Colorful, developer-friendly output
- Fast and reliable using official @solana/web3.js

## Installation

### Global Installation (Recommended)

```bash
npm install -g
npm link
```

Or if you want to install from a local directory:

```bash
npm install
npm run build
npm link
```

### Development

```bash
npm install
npm run build
npm link
```

## Usage

### Basic Usage

```bash
# Fetch by transaction signature
solana-raw-tx <transaction_signature>

# Fetch the latest transaction from the most recent block (real-time)
solana-raw-tx --latest

# Fetch the latest transaction for a specific address
solana-raw-tx --address <wallet_address>
```

Example:
```bash
solana-raw-tx 5Nnhjv1GVB8T1k8MguUGHQw5zQQQsWET1f1zzj8azRhnVoYQPoZPtkscPCKy6FisP2eVWehjU1EYV8zywqKm5if4

# Get the latest transaction in real-time
solana-raw-tx --latest
```

### Options

- `-r, --rpc <url>` - Custom RPC endpoint URL
- `-e, --encoding <type>` - Encoding type: `base64` (default), `base58`, or `jsonParsed`
- `-o, --output <file>` - Save raw bytes to a binary file (e.g., `tx.bin`)
- `-j, --json` - Output full JSON response from RPC
- `-q, --quiet` - Output only the raw encoded string (ideal for piping/scripting)
- `-n, --network <network>` - Network: `mainnet-beta` (default), `devnet`, or `testnet`
- `-l, --latest` - Fetch the latest transaction from the most recent block (real-time)
- `-a, --address <address>` - Fetch the latest transaction for a specific wallet address
- `-h, --help` - Display help information
- `-V, --version` - Display version number

### Examples

#### Get raw bytes in quiet mode (for scripting)

```bash
solana-raw-tx 5Nnhjv1GVB8T1k8MguUGHQw5zQQQsWET1f1zzj8azRhnVoYQPoZPtkscPCKy6FisP2eVWehjU1EYV8zywqKm5if4 --quiet
```

#### Save raw bytes to a file

```bash
solana-raw-tx <signature> --output raw.tx
```

#### Get hex output directly

```bash
solana-raw-tx <signature> --encoding base64 --quiet | base64 -d | xxd -p
```

Or use the tool's built-in hex display (shown in full output mode).

#### Use custom RPC endpoint

```bash
solana-raw-tx <signature> --rpc https://api.devnet.solana.com
```

#### Quick network switch

```bash
solana-raw-tx <signature> --network devnet
```

#### Get latest transaction in real-time

```bash
# Get the latest transaction from the most recent block
solana-raw-tx --latest

# Get the latest transaction for a specific address
solana-raw-tx --address 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

#### Get full JSON response

```bash
solana-raw-tx <signature> --json | jq
```

#### Pipe to other tools

```bash
# Get base64 and decode to binary
solana-raw-tx <signature> --quiet | base64 -d > transaction.bin

# Get base64 and convert to hex
solana-raw-tx <signature> --quiet | base64 -d | xxd -p
```

## Output

<img width="950" height="791" alt="Screenshot 2025-12-19 at 12 43 07" src="https://github.com/user-attachments/assets/75abb405-2a6e-4d5e-8c34-5b78e09a2a15" />

## Error Handling

The tool gracefully handles:
- Invalid transaction signatures
- Transactions not found
- RPC connection errors
- Network timeouts

## Requirements

- Node.js >= 16.0.0
- npm or yarn

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev <signature>

# Link globally for testing
npm link
```
