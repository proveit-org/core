import { MNEMONIC, AVATAR, ADDRESS } from '../config'
import { buildTree } from '../helper/merkle';

const blockchain = require('mvs-blockchain')({
    url: 'https://explorer-testnet.mvs.org/api/'
});

const Metaverse = require('metaversejs')
const Lodash_Array = require('lodash/array');

import { firestore } from 'firebase-admin';
import { EventContext } from 'firebase-functions';
const db = firestore();
const itemRef = db.collection('item');
const merkleRef = db.collection('merkle');

export const work = async (context: EventContext) => {
    try {

        // get all pending items that have not been processed and stored into a merkle tree
        const snapshot = await itemRef.where('hasMetaverseTestnet', '==', null).get()
        if (snapshot.empty) {
            console.log('Nothing to do... return to sleep');
            return;
        }

        const all_hashes: Array<string> = []
        snapshot.forEach((doc: any) => all_hashes.push(doc.data().hash))

        // firestore has a batch size limit of 500 commits per batch
        const chunks = Lodash_Array.chunk(all_hashes, 2)

        let utxoCandidates = await blockchain.utxo.get([ADDRESS])
        utxoCandidates = utxoCandidates.map((utxo: any) => {
            utxo.hash = utxo.tx
            utxo.locked_until = 0
            return utxo
        })

        for (const hashes of chunks) {

            const merkleData = {
                blockchain: 'metaverse-testnet',
                txid: null,
                leaves: hashes,
                created: firestore.Timestamp.now().seconds
            }

            await db.runTransaction(async (t) => {

                // create a new merkle tree
                const reference = merkleRef.doc()
                await t.set(reference, merkleData)
                console.log(`generated new merkle tree with id ${reference.id}`);

                // update item to reference to the merkle tree id
                hashes.forEach((hash: string) => {
                    t.update(itemRef.doc(hash), { hasMetaverseTestnet: reference.id });
                })

                const wallet = await Metaverse.wallet.fromMnemonic(MNEMONIC, 'testnet')

                console.info('select from following utxos', utxoCandidates)
                const txInput = await Metaverse.output.findUtxo(utxoCandidates, {}, 0)

                let transaction = await Metaverse.transaction_builder.registerMIT(txInput.utxo, ADDRESS, AVATAR, buildTree(hashes).root, "proveIt", ADDRESS, txInput.change)
                transaction = await wallet.sign(transaction)

                console.info('we will broadcast the following transaction', transaction)

                const pubTx = await blockchain.transaction.broadcast(transaction.encode().toString('hex'))

                console.log('published new transaction', pubTx)

                await t.update(merkleRef.doc(reference.id), { txid: pubTx.hash })

                //set new utxo for next merkle
                const newUtxo = {
                    address: ADDRESS,
                    attachment: { type: 'etp'},
                    value: transaction.outputs[transaction.outputs.length - 1].value,
                    hash: pubTx.hash,
                    index: transaction.outputs.length - 1,
                    locked_until: 0,
                }
                utxoCandidates = [newUtxo]

            })

        }
    }
    catch (error) {
        console.error(error)
    }
}