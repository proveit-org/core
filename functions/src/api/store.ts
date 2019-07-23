import { Request, Response, } from 'express';
const express = require("express")
export const storeApp = express()

import { firestore } from 'firebase-admin';
import { ok } from 'assert';

const db = firestore();

const itemRef = db.collection('item');

storeApp.get("", async (request: Request, response: Response) => {
    const hash = request.query.hash
    try {

        ok(hash, 'HASH_MISSING')
    
        //Check if record already exists
        const getItem = await itemRef.doc(hash).get()
        if (getItem.exists) throw Error('DUPLICATE_ENTRY')

        //Store new record
        await itemRef.doc(hash).set({
            hash,
            refToMerkle: null
        }).catch(error => {
            console.error(error)
            throw Error('HASH_STORE_FAILED')
        })

        return response.send("SUCCESS")

    } catch (error) {
        response.status(500)
        switch (error.message) {
            case 'HASH_MISSING':
            case 'DUPLICATE_ENTRY':
            case 'HASH_STORE_FAILED':
                return response.send(error.message)
        }
        return response.send('INTERNAL_ERROR')
    }
})