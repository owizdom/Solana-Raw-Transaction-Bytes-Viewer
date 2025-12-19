#!/usr/bin/env node

import { Command } from 'commander';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import chalk from 'chalk';
import * as fs from 'fs';

const program = new Command();

interface NetworkConfig {
  mainnet: string;
  devnet: string;
  testnet: string;
}

const NETWORKS: NetworkConfig = {
  mainnet: 'https://solana-mainnet.g.alchemy.com/v2/AFjoSzKjqv6Eq53OsF2xe',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
};

type Encoding = 'base64' | 'base58' | 'jsonParsed';

function getRpcUrl(network?: string, customRpc?: string): string {
  if (customRpc) return customRpc;
  if (network && network in NETWORKS) {
    return NETWORKS[network as keyof NetworkConfig];
  }
  return NETWORKS.mainnet;
}

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toISOString();
}

function formatSlot(slot: number | null | undefined): string {
  if (!slot) return 'N/A';
  return slot.toLocaleString();
}

function base64ToHex(base64: string): string {
  const buffer = Buffer.from(base64, 'base64');
  return buffer.toString('hex');
}

function hexToBase64(hex: string): string {
  const buffer = Buffer.from(hex, 'hex');
  return buffer.toString('base64');
}

function parseInstructions(tx: any): string[] {
  const instructions: string[] = [];
  
  if (tx.meta?.err) {
    instructions.push(chalk.red(`Transaction failed: ${JSON.stringify(tx.meta.err)}`));
  }
  
  if (tx.transaction?.message?.instructions) {
    tx.transaction.message.instructions.forEach((ix: any, idx: number) => {
      if (ix.parsed) {
        instructions.push(chalk.cyan(`  [${idx}] ${ix.parsed.type}: ${JSON.stringify(ix.parsed.info, null, 2)}`));
      } else if (ix.programId) {
        const programId = typeof ix.programId === 'string' ? ix.programId : ix.programId.toString();
        instructions.push(chalk.yellow(`  [${idx}] Program: ${programId}`));
      }
    });
  }
  
  return instructions;
}

async function getLatestTransactionFromAddress(
  address: string,
  rpcUrl: string,
  encoding: Encoding
): Promise<{ tx: any; signature: string }> {
  const connection = new Connection(rpcUrl, 'confirmed');
  
  try {
    const publicKey = new PublicKey(address);
    
    // Get the latest transaction signatures for this address
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      limit: 1,
    });
    
    if (!signatures || signatures.length === 0) {
      throw new Error(`No transactions found for address: ${address}`);
    }
    
    const latestSignature = signatures[0].signature;
    const tx = await fetchTransaction(latestSignature, rpcUrl, encoding);
    
    return { tx, signature: latestSignature };
  } catch (error: any) {
    if (error.message.includes('Invalid public key')) {
      throw new Error(`Invalid address format: ${address}`);
    }
    throw error;
  }
}

async function getLatestTransactionFromBlock(
  rpcUrl: string,
  encoding: Encoding
): Promise<{ tx: any; signature: string; slot: number }> {
  const connection = new Connection(rpcUrl, 'confirmed');
  
  try {
    // Get the latest block
    const slot = await connection.getSlot('confirmed');
    
    // Get block signatures (more efficient than full block)
    const blockSignatures = await connection.getBlockSignatures(slot);
    
    if (!blockSignatures || !blockSignatures.signatures || blockSignatures.signatures.length === 0) {
      throw new Error('No transactions found in the latest block');
    }
    
    // Get the first transaction signature from the latest block
    const signature = blockSignatures.signatures[0];
    const tx = await fetchTransaction(signature, rpcUrl, encoding);
    
    return { tx, signature, slot };
  } catch (error: any) {
    throw error;
  }
}

async function fetchTransaction(
  signature: string,
  rpcUrl: string,
  encoding: Encoding
): Promise<any> {
  const connection = new Connection(rpcUrl, 'confirmed');
  
  try {
    // First, get the transaction with full details for parsing
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    
    if (!tx) {
      throw new Error(`Transaction not found: ${signature}`);
    }
    
    // Get raw bytes directly from RPC using base64 encoding
    // This is the most reliable way to get the exact raw transaction bytes
    try {
      const rawResponse = await (connection as any)._rpcRequest('getTransaction', [
        signature,
        {
          encoding: 'base64',
          maxSupportedTransactionVersion: 0,
        },
      ]);
      
      if (rawResponse.result && rawResponse.result.transaction) {
        // The transaction can be returned as a string (base64) or array
        let rawTxBase64: string;
        
        if (Array.isArray(rawResponse.result.transaction)) {
          // Sometimes it's returned as [base64_string]
          rawTxBase64 = rawResponse.result.transaction[0];
        } else if (typeof rawResponse.result.transaction === 'string') {
          rawTxBase64 = rawResponse.result.transaction;
        } else {
          throw new Error('Unexpected transaction format from RPC');
        }
        
        if (rawTxBase64) {
          const serializedBytes = Buffer.from(rawTxBase64, 'base64');
          (tx as any).serializedBytes = serializedBytes;
          (tx as any).serializedBase64 = rawTxBase64;
          (tx as any).serializedHex = serializedBytes.toString('hex');
        }
      }
    } catch (rpcError: any) {
      // If direct RPC call fails, try to reconstruct from the transaction object
      // This is a fallback method
      try {
        if (tx.transaction) {
          // Try to serialize the transaction object
          let serializedTx: Buffer;
          
          if (tx.version === 'legacy' || tx.version === undefined) {
            // For legacy transactions, we need to reconstruct
            const message = tx.transaction.message;
            if (message) {
              // Create a new transaction and serialize it
              const newTx = new Transaction();
              // Note: This is a simplified approach - full reconstruction would require
              // all transaction components
              // For now, we'll rely on the RPC method above
            }
          }
        }
      } catch (fallbackError) {
        // If all methods fail, we'll show a warning but still display what we can
        console.warn(chalk.yellow('Warning: Could not retrieve raw transaction bytes. Some features may be limited.'));
      }
    }
    
    return tx;
  } catch (error: any) {
    if (error.message.includes('not found')) {
      throw new Error(`Transaction not found: ${signature}`);
    }
    throw error;
  }
}

function displayTransactionInfo(tx: any, encoding: Encoding, quiet: boolean) {
  if (quiet) {
    // In quiet mode, just output the raw bytes
    if (tx.serializedBase64) {
      console.log(tx.serializedBase64);
    } else if (tx.serializedHex) {
      console.log(tx.serializedHex);
    } else {
      console.error('Transaction found but raw bytes not available');
      process.exit(1);
    }
    return;
  }

  // Display header
  console.log(chalk.bold.blue('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║          Solana Raw Transaction Bytes Viewer              ║'));
  console.log(chalk.bold.blue('╚═══════════════════════════════════════════════════════════╝\n'));

  // Transaction Status
  const status = tx.meta?.err ? chalk.red('FAILED') : chalk.green('SUCCESS');
  console.log(chalk.bold('Status:'), status);
  
  if (tx.meta?.err) {
    console.log(chalk.red('Error:'), JSON.stringify(tx.meta.err, null, 2));
  }

  // Basic Info
  console.log(chalk.bold('\nTransaction Details:'));
  console.log(`  Signature: ${chalk.cyan(tx.transaction?.signatures?.[0] || 'N/A')}`);
  console.log(`  Slot: ${chalk.yellow(formatSlot(tx.slot))}`);
  console.log(`  Block Time: ${chalk.yellow(formatDate(tx.blockTime))}`);
  console.log(`  Fee: ${chalk.yellow(`${tx.meta?.fee || 0} lamports`)}`);
  
  // Signers
  if (tx.transaction?.signatures) {
    console.log(chalk.bold('\nSigners:'));
    tx.transaction.signatures.forEach((sig: string, idx: number) => {
      console.log(`  [${idx}] ${chalk.cyan(sig)}`);
    });
  }

  // Transaction Version
  if (tx.version !== undefined) {
    const versionType = tx.version === 'legacy' ? 'Legacy' : `Versioned (v${tx.version})`;
    console.log(chalk.bold('\nTransaction Type:'), chalk.yellow(versionType));
  }

  // Raw Bytes - Base64 and Hex
  if (tx.serializedBase64) {
    const base64 = tx.serializedBase64;
    const hex = tx.serializedHex || base64ToHex(base64);
    const byteLength = tx.serializedBytes?.length || Buffer.from(base64, 'base64').length;
    
    console.log(chalk.bold('\nRaw Transaction (Base64):'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.white(base64));
    console.log(chalk.gray('─'.repeat(60)));
    
    console.log(chalk.bold('\nRaw Transaction (Hexadecimal):'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.white(hex));
    console.log(chalk.gray('─'.repeat(60)));
    
    console.log(chalk.dim(`\nLength: ${base64.length} chars (base64), ${hex.length} chars (hex), ${byteLength} bytes`));
  } else {
    console.log(chalk.yellow('\nWarning: Raw transaction bytes not available'));
    console.log(chalk.dim('   The transaction was fetched but could not be serialized to raw bytes.'));
    console.log(chalk.dim('   Try using --json to see the full transaction data.'));
  }

  // Instructions
  const instructions = parseInstructions(tx);
  if (instructions.length > 0) {
    console.log(chalk.bold('\nInstructions:'));
    instructions.forEach(ix => console.log(ix));
  }

  // Error Logs
  if (tx.meta?.logMessages && tx.meta.logMessages.length > 0) {
    console.log(chalk.bold('\nLog Messages:'));
    tx.meta.logMessages.forEach((log: string, idx: number) => {
      const color = log.includes('error') || log.includes('Error') ? chalk.red : chalk.gray;
      console.log(color(`  [${idx}] ${log}`));
    });
  }

  console.log('\n');
}

async function main() {
  program
    .name('solana-raw-tx')
    .description('Fetch and display raw Solana transaction bytes')
    .version('1.0.0')
    .argument('[signature]', 'Transaction signature to fetch (optional if using --latest or --address)')
    .option('-r, --rpc <url>', 'Custom RPC endpoint URL')
    .option('-e, --encoding <type>', 'Encoding type (base64, base58, jsonParsed)', 'base64')
    .option('-o, --output <file>', 'Save raw bytes to file (.bin)')
    .option('-j, --json', 'Output full JSON response from RPC')
    .option('-q, --quiet', 'Output only the raw encoded string (for piping/scripting)')
    .option('-n, --network <network>', 'Network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('-l, --latest', 'Fetch the latest transaction from the most recent block')
    .option('-a, --address <address>', 'Fetch the latest transaction for a specific address')
    .action(async (signature: string | undefined, options: {
      rpc?: string;
      encoding?: string;
      output?: string;
      json?: boolean;
      quiet?: boolean;
      network?: string;
      latest?: boolean;
      address?: string;
    }) => {
      try {
        const rpcUrl = getRpcUrl(options.network, options.rpc);
        const encoding = options.encoding as Encoding;

        if (!['base64', 'base58', 'jsonParsed'].includes(encoding)) {
          throw new Error('Invalid encoding. Must be: base64, base58, or jsonParsed');
        }

        let tx: any;
        let displaySignature: string | undefined = signature;

        // Determine which mode to use
        if (options.latest) {
          // Fetch latest transaction from block
          if (!options.quiet && !options.json) {
            console.log(chalk.dim(`Fetching latest transaction from ${rpcUrl}...`));
          }
          const result = await getLatestTransactionFromBlock(rpcUrl, encoding);
          tx = result.tx;
          displaySignature = result.signature;
          if (!options.quiet && !options.json) {
            console.log(chalk.dim(`Found latest transaction from block ${result.slot}: ${result.signature}`));
          }
        } else if (options.address) {
          // Fetch latest transaction from address
          if (!options.quiet && !options.json) {
            console.log(chalk.dim(`Fetching latest transaction for address ${options.address} from ${rpcUrl}...`));
          }
          const result = await getLatestTransactionFromAddress(options.address, rpcUrl, encoding);
          tx = result.tx;
          displaySignature = result.signature;
          if (!options.quiet && !options.json) {
            console.log(chalk.dim(`Found latest transaction: ${result.signature}`));
          }
        } else if (signature) {
          // Fetch by signature (original behavior)
          // Validate signature format (basic check)
          if (signature.length < 64) {
            throw new Error('Invalid transaction signature format');
          }

          if (!options.quiet && !options.json) {
            console.log(chalk.dim(`Fetching transaction from ${rpcUrl}...`));
          }

          tx = await fetchTransaction(signature, rpcUrl, encoding);
        } else {
          throw new Error('Please provide a transaction signature, use --latest to get the latest transaction, or --address to get the latest transaction for an address');
        }

        // JSON output mode
        if (options.json) {
          console.log(JSON.stringify(tx, null, 2));
          return;
        }

        // Save to file if requested
        if (options.output) {
          if (tx.serializedBytes) {
            fs.writeFileSync(options.output, tx.serializedBytes);
            if (!options.quiet) {
              console.log(chalk.green(`Saved raw bytes to ${options.output} (${tx.serializedBytes.length} bytes)`));
            }
          } else if (tx.serializedBase64) {
            const buffer = Buffer.from(tx.serializedBase64, 'base64');
            fs.writeFileSync(options.output, buffer);
            if (!options.quiet) {
              console.log(chalk.green(`Saved raw bytes to ${options.output} (${buffer.length} bytes)`));
            }
          } else {
            throw new Error('Raw transaction bytes not available to save');
          }
        }

        // Display transaction info
        displayTransactionInfo(tx, encoding, options.quiet || false);
        
        // Show which transaction was fetched if using latest/address mode
        if ((options.latest || options.address) && !options.quiet && !options.json && displaySignature) {
          console.log(chalk.dim(`\nTransaction signature: ${displaySignature}`));
        }

      } catch (error: any) {
        if (!options.quiet) {
          console.error(chalk.red('Error:'), error.message);
        } else {
          console.error(error.message);
        }
        process.exit(1);
      }
    });

  program.parse();
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});

