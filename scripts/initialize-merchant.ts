import { readFile } from 'node:fs/promises';
import { createKeyPairSignerFromBytes, createSolanaRpc, createSolanaRpcSubscriptions, pipe,
  createTransactionMessage, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction, signTransactionMessageWithSigners, sendAndConfirmTransactionFactory,
  address, getSignatureFromTransaction } from '@solana/kit';
import { getCreateAssociatedTokenIdempotentInstructionAsync } from '@solana-program/token';

const signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(await readFile('.claimcheck/wallet/merchant.json', 'utf8'))));
const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
const rpcSubscriptions = createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com');
const instruction = await getCreateAssociatedTokenIdempotentInstructionAsync({
  payer: signer, owner: signer.address, mint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
});
const { value: blockhash } = await rpc.getLatestBlockhash().send();
const message = pipe(createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(signer, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
  (tx) => appendTransactionMessageInstruction(instruction, tx));
const transaction = await signTransactionMessageWithSigners(message);
await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(transaction, { commitment: 'confirmed' });
console.log(`Merchant USDC account initialized: ${getSignatureFromTransaction(transaction)}`);
