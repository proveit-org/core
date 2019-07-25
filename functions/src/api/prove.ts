import { Request, Response, } from 'express';
const express = require("express")
export const proveApp = express()
const cors = require('cors')
proveApp.use(cors())

import { firestore, storage } from 'firebase-admin';
import { ok } from 'assert';
import { buildTree } from '../helper/merkle';

const db = firestore();

const itemRef = db.collection('item');
const merkleRef = db.collection('merkle');

const bucket = storage().bucket();

proveApp.get("*", async (request: Request, response: Response) => {
    const hash = request.query.hash
    try {

        ok(hash, 'HASH_MISSING')

        const [hasFile] = (await bucket.file(hash + '.pdf').exists())

        // get the merkle tree that contains this has in its array of leaves
        const getMerkle = await merkleRef
            .where('leaves', 'array-contains', hash)
            .get()

        const getItem = await itemRef
            .where('hash', '==', hash)
            .get()

        // if we also can't find it in the item collectoin
        if (getItem.empty) {
            return response.status(404).send('Item not found. Proof failed.')
        }

        // if we don't find it in any merkle tree, check the item collection 
        if (getMerkle.empty) {

            return response.json({
                hash: getItem.docs[0].data().hash,
                meta: getItem.docs[0].data().meta,
                hasFile,
                status: 'pending',
            })
        }

        const proofs = getMerkle.docs.map((merkle) => {
            const txid = merkle.data().txid
            const leaves: Array<string> = merkle.data().leaves
            if (!Array.isArray(leaves)) throw Error('INVALID_MERKLE_TREE')
            const tree = buildTree(leaves, leaves.indexOf(hash))
            return {
                blockchain: merkle.data().blockchain,
                txid,
                path: tree.path,
                root: tree.root,
            }
        })

        return response.json({
            hash,
            proofs,
            meta: getItem.docs[0].data().meta,
            hasFile,
            status: 'published',
        })

    } catch (error) {
        response.status(500)
        switch (error.message) {
            case 'HASH_MISSING':
            case 'DUPLICATE_ENTRY':
            case 'INVALID_MERKLE_TREE':
            case 'HASH_STORE_FAILED':
                return response.send(error.message)
        }
        console.error(error)
        return response.send('INTERNAL_ERROR')
    }
})

