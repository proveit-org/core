import 'source-map-support/register';
import * as functions from 'firebase-functions';
const merkle = require('merkle');

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
            response.status(404).send('Item not found. Proof failed.')
        }

        
        response.json({hash: getItem.docs[0].data().hash, status: 'pending'})
    }

    const txid = getMerkle.docs[0].data().txid
    const leaves: Array<string> = getMerkle.docs[0].data().leaves

    if (!Array.isArray(leaves)) {
        response.status(500).send('Invalid merkle tree')
    }

    const tree = merkle('sha256', false).sync(leaves)
    const root = tree.root()
    const path = tree.getProofPath(leaves.indexOf(hash))


    response.json({root, path, hash, txid, status: txid ? 'published' : 'processing'})

});

// Process item collections and make a merkle tree
export const mvsWorker = functions.pubsub.schedule('every 10 minutes')
    .timeZone('America/New_York')
    .onRun(async (context) => {
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
            open: true,
            leaves: hashes
        }

        const { id } = await merkleRef.add(merkleData)
        console.log(`generated new merkle tree with id ${id}`);

        const batch = db.batch();

        hashes.forEach((hash: string) => {
            batch.update(itemRef.doc(hash), { refToMerkle: id });
        })
        batch.commit().catch((err: Error) => console.error(err));

    });

// Publish merkle trees to the sp@firebase/firestore-typesecified blockchain
export const publish = functions.pubsub.schedule('every 20 minutes')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        const snapshot = await merkleRef.where('txid', '==', null).get()
        if (snapshot.empty) {
            console.log('No unpublished merkle trees.')
            return
        }

    });
