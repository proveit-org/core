import 'source-map-support/register';
import { MNEMONIC, AVATAR, ADDRESS } from './config'
import * as functions from 'firebase-functions';

const blockchain = require('mvs-blockchain')({
    url: 'https://explorer-testnet.mvs.org/api/'
});

const merkle = require('merkle');
const Metaverse = require('metaversejs')

const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const itemRef = db.collection('item');
const merkleRef = db.collection('merkle');


// Add to collection
export const store = functions.https.onRequest(async (request, response) => {
    const hash = request.query.hash
    const getItem = await itemRef.doc(hash).get()
    if (!getItem.exists) {
        itemRef.doc(hash).set({
            hash,
            refToMerkle: null
        });
        response.send("Stored")
        return
    }
    response.status(400).send("Duplicated hash");
});

// Retrieve 
export const prove = functions.https.onRequest(async (request, response) => {

    const hash = request.query.hash

    // get the merkle tree that contains this has in its array of leaves
    const getMerkle = await merkleRef
        .where('blockchain', '==', 'metaverse')
        .where('leaves', 'array-contains', hash)
        .get()

    // if we don't find it in any merkle tree, check the item collection 
    if (getMerkle.empty) {
        const getItem = await itemRef
            .where('hash', '==', hash)
            .get()

        // if we also can't find it in the item collectoin
        if (getItem.empty) {
            return response.status(404).send('Item not found. Proof failed.')
        }


        return response.json({ hash: getItem.docs[0].data().hash, status: 'pending' })
    }

    const txid = getMerkle.docs[0].data().txid
    const leaves: Array<string> = getMerkle.docs[0].data().leaves

    if (!Array.isArray(leaves)) {
        return response.status(500).send('Invalid merkle tree')
    }

    const tree = buildTree(leaves, leaves.indexOf(hash))

    return response.json({ root: tree.root, path: tree.path, hash, txid, status: txid ? 'published' : 'processing' })

});

// Build a tree given hashes as leaves and return the root
// optionally return path if path index is provided
function buildTree(leaves:string[], pathIndex?: number) : any {
    const tree = merkle('sha256', false).sync(leaves)
    return {root: tree.root(), ...( pathIndex && {path: tree.getProofPath(pathIndex)}) }
}

// Process item collections and make a merkle tree
export const mvsWorker = functions.pubsub.schedule('every 1 minutes')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        try {

            // get all pending items that have not been processed and stored into a merkle tree
            const snapshot = await itemRef.where('refToMerkle', '==', null).get()
            if (snapshot.empty) {
                console.log('Nothing to do... return to sleep');
                return;
            }

            const hashes: Array<string> = []
            snapshot.forEach((doc: any) => hashes.push(doc.data().hash))

            const merkleData = {
                blockchain: 'metaverse',
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

            const utxoCandidates: any[] = [{
                address: "tLPPUUy7NhW9QQebLyxoJLajQJh1cVuHJx",
                attachment: { "type": "etp" },
                index: 1,
                locked_until: 0,
                value: 201800000000,
                hash: "941e6324ce3fbc3bd58ebae52b2a1f197cb15a4263811edbbd284044ae089d45",
            }] //call explorer

            // publish to metaverse blockchain (register the root hash as a MIT)
            
            const wallet = await Metaverse.wallet.fromMnemonic(MNEMONIC, 'testnet')

            const txInput = await Metaverse.output.findUtxo(utxoCandidates, {}, 0)
            
            let transaction = await Metaverse.transaction_builder.registerMIT(txInput.utxo, ADDRESS, AVATAR, buildTree(hashes).root, "proveIt", ADDRESS, txInput.change)
            transaction = await wallet.sign(transaction)

            const pubTx = await blockchain.transaction.broadcast(transaction.encode().toString('hex'))

            console.log('published new transaction', pubTx)

            await merkleRef.doc(id).update({ txid: pubTx.hash })

            batch.commit().catch((err: Error) => console.error(err));

        }
        catch (error) {
            console.error(error)
        }
    });

