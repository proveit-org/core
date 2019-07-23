import { MNEMONIC, AVATAR, ADDRESS } from '../config'
import { buildTree } from '../helper/merkle';

const blockchain = require('mvs-blockchain')({
    url: 'https://explorer-testnet.mvs.org/api/'
});

const Metaverse = require('metaversejs')

import { firestore } from 'firebase-admin';
import { EventContext } from 'firebase-functions';
const db = firestore();
const itemRef = db.collection('item');
const merkleRef = db.collection('merkle');

export const work = async (context: EventContext) => {
    try {

        // get all pending items that have not been processed and stored into a merkle tree
        const snapshot = await itemRef.where('refToMerkle', '==', null).get()
        if (snapshot.empty) {
            console.log('Nothing to do... return to sleep');
            return;
        }

        //TODO: implement max batch size (500) https://lodash.com/ and loop through

        const hashes: Array<string> = []
        snapshot.forEach((doc: any) => hashes.push(doc.data().hash))

        const merkleData = {
            blockchain: 'metaverse-testnet',
            txid: null,
            leaves: hashes
        }

        const batch = db.batch();

        // create a new merkle tree
        const { id } = await merkleRef.add(merkleData)
        console.log(`generated new merkle tree with id ${id}`);

        // update item to reference to the merkle tree id
        hashes.forEach((hash: string) => {
            batch.update(itemRef.doc(hash), { refToMerkle: id });
        })

        let utxoCandidates = await blockchain.utxo.get([ADDRESS])
        utxoCandidates = utxoCandidates.map((utxo: any) => {
            utxo.hash = utxo.tx
            utxo.locked_until = 0
            return utxo
        })

        // publish to metaverse blockchain (register the root hash as a MIT)

        const wallet = await Metaverse.wallet.fromMnemonic(MNEMONIC, 'testnet')

        const txInput = await Metaverse.output.findUtxo(utxoCandidates, {}, 0)

        let transaction = await Metaverse.transaction_builder.registerMIT(txInput.utxo, ADDRESS, AVATAR, buildTree(hashes).root, "proveIt", ADDRESS, txInput.change)
        transaction = await wallet.sign(transaction)

        const pubTx = await blockchain.transaction.broadcast(transaction.encode().toString('hex'))

        console.log('published new transaction', pubTx)

        // await merkleRef.doc(id).update({ txid: pubTx.hash })
        await batch.update(merkleRef.doc(id), { "txid": pubTx.hash })

        batch.commit().catch((err: Error) => console.error(err));

    }
    catch (error) {
        console.error(error)
    }
}