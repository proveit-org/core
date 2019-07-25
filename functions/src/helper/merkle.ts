const merkle = require('merkle')
const crypto = require('crypto')

/**
 * Build a tree given hashes as leaves and return the root optionally 
 * return path if path index is provided
 * @param leaves string[]
 * @param pathIndex number
 */
export function buildTree(leaves:string[], pathIndex?: number) : any {
    const tree = merkle('sha256', false).sync(leaves)
    return {root: tree.root(), ...( pathIndex !==undefined && pathIndex>=0 && {path: tree.getProofPath(pathIndex)}) }
}

/**
 * Get the hash for storing and retrieving files given the hash of the file
 * and an optional password 
 * @param hash 
 * @param password 
 */
export function getFileHash(hash: string, password: string) {
    if (password) {
       return crypto.createHash('md5').update(hash+password).digest('hex');
    }  
    return hash
}